import { css } from '@emotion/css';
import {
  Component,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

import {
  type GrafanaTheme2,
  type QueryEditorCoauthoringControllerV1,
  type QueryEditorCoauthoringV1Props,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, ClipboardButton, useStyles2 } from '@grafana/ui';

import { QueryCoauthoring } from './QueryCoauthoring';
import { useQueryCoauthoringHost } from './QueryCoauthoringHostContext';

export function QueryCoauthoringExposedComponent(props: QueryEditorCoauthoringV1Props) {
  const host = useQueryCoauthoringHost();

  return (
    <QueryCoauthoringFailureBoundary resetKey={props.createController} onFailure={host.revert}>
      <QueryCoauthoringControllerSurface createController={props.createController} />
    </QueryCoauthoringFailureBoundary>
  );
}

function QueryCoauthoringControllerSurface({
  createController,
}: Pick<QueryEditorCoauthoringV1Props, 'createController'>) {
  const host = useQueryCoauthoringHost();
  const controller = useMemo(() => createController(), [createController]);
  const handleFailure = useCallback(() => {
    controller.clearEditorDiff();
    host.revert();
  }, [controller, host]);

  return (
    <QueryCoauthoringFailureBoundary resetKey={controller} onFailure={handleFailure}>
      <QueryCoauthoringSurface controller={controller} />
    </QueryCoauthoringFailureBoundary>
  );
}

class QueryCoauthoringFailureBoundary extends Component<
  { children: ReactNode; onFailure: () => void; resetKey: object },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  componentDidUpdate(previousProps: Readonly<{ resetKey: object }>) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function QueryCoauthoringSurface({ controller }: { controller: QueryEditorCoauthoringControllerV1 }) {
  const host = useQueryCoauthoringHost();
  const styles = useStyles2(getStyles);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const portalTarget = controller.getPortalTarget();

  useLayoutEffect(() => {
    const updateSurfaceSize = () => {
      const { height, width } = portalTarget.getBoundingClientRect();
      controller.reportSurfaceSize({ height, width });
    };

    updateSurfaceSize();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(updateSurfaceSize);
    resizeObserver.observe(portalTarget);
    return () => resizeObserver.disconnect();
  }, [controller, portalTarget]);

  const begin = useCallback(() => {
    void controller.begin().catch(() => undefined);
  }, [controller]);

  if (snapshot.mode === 'hidden') {
    return null;
  }

  if (snapshot.mode === 'selection') {
    const preserveSelection = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();
    return createPortal(
      <div className={styles.toolbarSurface} data-testid="query-coauthoring-selection-toolbar">
        <ClipboardButton
          fill="text"
          getText={() => snapshot.selectedText}
          onMouseDown={preserveSelection}
          size="sm"
          variant="secondary"
        >
          {t('query-editor-coauthoring.copy', 'Copy')}
        </ClipboardButton>
        <span aria-hidden="true" className={styles.divider} />
        <Button
          fill="text"
          icon="ai-sparkle"
          onClick={begin}
          onMouseDown={preserveSelection}
          size="sm"
          variant="secondary"
        >
          {t('query-editor-coauthoring.coauthor', 'Coauthor')}
        </Button>
      </div>,
      portalTarget
    );
  }

  return (
    <QueryCoauthoring
      controller={controller}
      datasourceType={host.datasourceType}
      onAccept={host.accept}
      onPreview={host.preview}
      onRevertPreview={host.revert}
      timeRange={host.timeRange}
    />
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    divider: css({
      width: 1,
      alignSelf: 'stretch',
      background: theme.colors.border.weak,
    }),
    toolbarSurface: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      width: 'max-content',
      maxWidth: 'calc(100vw - 16px)',
      padding: theme.spacing(0.5),
      color: theme.colors.text.primary,
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      overflow: 'hidden',
    }),
  };
}
