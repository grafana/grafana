import { useEffect, useMemo, useRef, useState } from 'react';

import { type InterpolateFunction } from '@grafana/data';

import { createHostHelperResolver } from './handlebars';
import { catchTemplateError, interpolateTemplateSteps, type RenderedContent, type TextTemplate } from './renderContent';
import { type createTemplateSandbox } from './templateSandbox/client';
import { type HelperValue } from './templateSandbox/protocol';

/** Drives the same interpolation steps for the panel and the editor's debounced draft. */
export function useTemplateContent(
  template: TextTemplate,
  replaceVariables: InterpolateFunction,
  enabled = true,
  renderCounter?: number
): RenderedContent {
  const { content, mode, series, renderMode, format, rowWindow } = template;
  const job = useMemo(() => {
    const steps = interpolateTemplateSteps({ content, mode, series, renderMode, format, rowWindow }, replaceVariables);
    try {
      return {
        revision: renderCounter,
        first: enabled ? steps.next() : { done: true as const, value: { content: '', truncated: false } },
      };
    } catch (error) {
      return {
        revision: renderCounter,
        error: catchTemplateError(() => {
          throw error;
        }),
      };
    }
  }, [content, mode, series, renderMode, format, rowWindow, replaceVariables, enabled, renderCounter]);
  const sandbox = useRef<ReturnType<typeof createTemplateSandbox> | undefined>(undefined);
  const [result, setResult] = useState<{ job: typeof job; value: RenderedContent }>();

  useEffect(
    () => () => {
      sandbox.current?.dispose();
      sandbox.current = undefined;
    },
    []
  );

  useEffect(() => {
    if (!job.first || job.first.done) {
      sandbox.current?.dispose();
      sandbox.current = undefined;
      return;
    }
    const abort = new AbortController();
    async function render() {
      try {
        const { createTemplateSandbox } = await import('./templateSandbox/client');
        if (abort.signal.aborted) {
          return;
        }
        if (!sandbox.current || sandbox.current.disposed) {
          sandbox.current = createTemplateSandbox();
        }
        // Effects can restart in StrictMode; each run needs its own generator.
        const steps = interpolateTemplateSteps(
          { content, mode, series, renderMode, format, rowWindow },
          replaceVariables
        );
        let step = steps.next();
        const helpers = new Map<string, HelperValue>();
        const resolveHelper = createHostHelperResolver(replaceVariables);
        while (!step.done) {
          step = steps.next(await sandbox.current.render(step.value, resolveHelper, abort.signal, helpers));
        }
        if (!abort.signal.aborted) {
          setResult({ job, value: step.value });
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          setResult({
            job,
            value: catchTemplateError(() => {
              throw error;
            }),
          });
        }
      }
    }
    void render();
    return () => abort.abort();
  }, [job, content, mode, series, renderMode, format, rowWindow, replaceVariables]);

  if (job.error) {
    return job.error;
  }
  if (job.first?.done) {
    return job.first.value;
  }
  return result?.job === job ? result.value : { content: '', pending: true };
}
