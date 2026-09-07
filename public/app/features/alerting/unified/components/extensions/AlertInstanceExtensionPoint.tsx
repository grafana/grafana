import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { combineLatest } from 'rxjs';

import { type PluginExtensionLink, PluginExtensionPoints } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getObservablePluginLinks, usePluginLinks } from '@grafana/runtime';
import { Dropdown, IconButton } from '@grafana/ui';
import { type Alert, type CombinedRule } from 'app/types/unified-alerting';

import { AlertingRuleExtensionPointMenu } from './AlertingRuleExtensionPointMenu';
import { ConfirmNavigationModal } from './ConfirmationNavigationModal';

interface Props {
  rule?: CombinedRule;
  instance: Alert;
}

export type PluginExtensionAlertInstanceContext = {
  rule?: {
    name: string;
    query: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    uid?: string;
  };
  instance: {
    activeAt: string;
    annotations: Record<string, string>;
    labels: Record<string, string>;
    state: string;
    value: string;
  };
};

/** Build the flat serializable context for a single alert instance. */
export function buildAlertInstancePluginContext(
  rule: CombinedRule | undefined,
  instance: Alert
): PluginExtensionAlertInstanceContext {
  return {
    rule: rule
      ? {
          name: rule.name,
          query: rule.query,
          labels: rule.labels ?? {},
          annotations: rule.annotations ?? {},
          uid: rule.uid,
        }
      : undefined,
    instance: {
      activeAt: instance.activeAt,
      annotations: instance.annotations,
      labels: instance.labels,
      state: instance.state,
      value: instance.value,
    },
  };
}

export function useAlertInstancePluginLinks(rule: CombinedRule | undefined, instance: Alert): PluginExtensionLink[] {
  const emptyResponse = useRef<PluginExtensionLink[]>([]);

  const context = useMemo<PluginExtensionAlertInstanceContext>(
    () => buildAlertInstancePluginContext(rule, instance),
    [rule, instance]
  );

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.AlertInstanceAction,
    context,
    limitPerPlugin: 3,
  });

  return links.length > 0 ? links : emptyResponse.current;
}

/**
 * Table-level hook: determines whether any of the visible instances has at least one applicable
 * plugin link.  Uses `getObservablePluginLinks` so that `configure()` is called with the real
 * per-instance context and the result re-evaluates whenever the extension registry changes.
 *
 * Returns { hasLinks, isLoading }.  While isLoading is true the caller should not conclude that
 * no plugin actions exist.
 */
export function useHasAlertInstancePluginLinks(
  rule: CombinedRule | undefined,
  instances: Alert[]
): { hasLinks: boolean; isLoading: boolean } {
  const [state, setState] = useState<{ hasLinks: boolean; isLoading: boolean }>({
    hasLinks: false,
    isLoading: true,
  });

  useEffect(() => {
    if (instances.length === 0) {
      setState({ hasLinks: false, isLoading: false });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    const observables = instances.map((instance) =>
      getObservablePluginLinks({
        extensionPointId: PluginExtensionPoints.AlertInstanceAction,
        context: buildAlertInstancePluginContext(rule, instance),
        limitPerPlugin: 3,
      })
    );

    const subscription = combineLatest(observables).subscribe((allLinks) => {
      setState({ hasLinks: allLinks.some((links) => links.length > 0), isLoading: false });
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule, instances]);

  return state;
}

export function AlertInstanceExtensionPoint({ rule, instance }: Props): ReactElement | null {
  const [selectedExtension, setSelectedExtension] = useState<PluginExtensionLink | undefined>();
  const links = useAlertInstancePluginLinks(rule, instance);

  if (links.length === 0) {
    return null;
  }

  return (
    <>
      <Dropdown
        placement="bottom-start"
        overlay={<AlertingRuleExtensionPointMenu extensions={links} onSelect={setSelectedExtension} />}
      >
        <IconButton
          name="ellipsis-v"
          aria-label={t('alerting.alert-instance-extension-point.actions', 'Alert instance actions')}
          variant="secondary"
        />
      </Dropdown>

      {!!selectedExtension?.path && (
        <ConfirmNavigationModal
          path={selectedExtension.path}
          title={selectedExtension.title}
          onDismiss={() => setSelectedExtension(undefined)}
        />
      )}
    </>
  );
}
