import { Observable, from } from 'rxjs';
import { concatMap, filter, first } from 'rxjs/operators';
import { rangeUtil, readCSV, toDataFrame, QueryRunner, applyFieldOverrides, GrafanaTheme2 } from '@grafana/data';
import {
  StoryboardContext,
  StoryboardDocumentElement,
  StoryboardVariable,
  UnevaluatedStoryboardDocument,
  EvaluatedStoryboardDocument,
} from './types';

export async function evaluateElement({
  runner,
  context,
  theme,
  n,
}: {
  runner: QueryRunner;
  context: StoryboardContext;
  theme: GrafanaTheme2;
  n: StoryboardDocumentElement;
}): Promise<StoryboardVariable> {
  let result: StoryboardVariable = { element: n, value: undefined };
  switch (n.type) {
    case 'markdown': {
      // value should be JSX:  https://github.com/rexxars/commonmark-react-renderer
      result.value = n.content;
      break;
    }
    case 'query': {
      if (n.datasourceUid == null) {
        result.error = 'datasource unselected';
        return result;
      }

      try {
        runner.run({
          timeRange: rangeUtil.convertRawToRange(n.timeRange),
          queries: [n.query],
          datasource: { uid: n.datasourceUid },
          timezone: '',
          maxDataPoints: 100,
          minInterval: null,
        });
        const value = await runner
          .get()
          .pipe(
            filter((ev) => {
              return ev.state === 'Done' && ev.series.length > 0 && ev.series[0].refId === n.id;
            }),
            first()
          )
          .toPromise();

        if (value != null) {
          value.series = applyFieldOverrides({
            data: value.series,
            fieldConfig: {
              defaults: {},
              overrides: [],
            },
            theme,
            replaceVariables: (v) => v,
          });
        }
        result.value = value;
      } catch (e) {
        console.error('TEMP ERROR HANDLER: ', e);
      }
      break;
    }
    case 'csv': {
      // TODO: Use real CSV algorithm to split!
      result.value = readCSV(n.content.text);
      break;
    }
    case 'plaintext': {
      result.value = n.content;
      break;
    }
    case 'python': {
      const runOutput = await run(n.script, context);
      result.stdout = runOutput.stdout;
      result.error = runOutput.error;
      if (n.returnsDF && runOutput.error === undefined) {
        try {
          result.value = toDataFrame(JSON.parse(runOutput.results));
        } catch (error) {
          result.error = `Error getting DataFrame from Python cell:
          ${error.toString()}`;
        }
      }
      break;
    }
  }
  return result;
}

/// Transforms a document into an evaledDocument (has results)
export function evaluateDocument({
  runner,
  theme,
  doc,
}: {
  runner: QueryRunner;
  theme: GrafanaTheme2;
  doc: UnevaluatedStoryboardDocument;
}): Observable<EvaluatedStoryboardDocument> {
  const result: EvaluatedStoryboardDocument = {
    title: doc.title,
    status: 'evaluating',
    context: {},
    elements: doc.elements,
  };

  const obs: Observable<EvaluatedStoryboardDocument> = from<StoryboardDocumentElement[]>(doc.elements).pipe(
    concatMap(async (n: StoryboardDocumentElement) => {
      console.log('Evaluating %s with context %o', n.id, result.context);
      const res = await evaluateElement({ runner, context: result.context, n, theme });
      result.context[n.id] = res;
      return { ...result };
    })
  );

  return obs;
}

let pyodideWorker: Worker | undefined =
  Worker && new Worker(new URL('./web-workers/pyodide.worker.js', import.meta.url));

export function runCallback(
  script: string,
  context: StoryboardContext,
  onSuccess: (data: any) => void,
  onError: (ev: ErrorEvent) => any
) {
  if (pyodideWorker == null) {
    return;
  }
  pyodideWorker.onerror = (e) => onError(e);
  pyodideWorker.onmessage = (e) => onSuccess(e.data);
  pyodideWorker.postMessage({
    // Need to deep copy the object to avoid DOMExceptions when objects can't be cloned.
    ...JSON.parse(JSON.stringify(context)),
    python: script,
  });
}

export function run(script: string, context: StoryboardContext): Promise<any> {
  return new Promise(function (onSuccess, onError) {
    runCallback(script, context, onSuccess, onError);
  });
}
