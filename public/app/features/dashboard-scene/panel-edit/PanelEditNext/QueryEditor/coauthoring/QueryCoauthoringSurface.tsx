import { css } from '@emotion/css';
import { Component, type MouseEvent, type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { type PanelData, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Button, useStyles2 } from '@grafana/ui';
import { getModKey } from 'app/core/utils/browser';

import { QueryCoauthoring } from './QueryCoauthoring';
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringSnapshotV1,
} from './internalCoauthoringContract';
import { type QueryPreviewSelection } from './queryPreview';

interface Props {
  adapter: QueryEditorCoauthoringAdapterV1;
  host: QueryCoauthoringHost;
  onBaseline: (query: DataQuery) => boolean;
}

interface QueryCoauthoringHost {
  datasourceType: string;
  previewPhase: 'idle' | 'pending' | 'running' | 'complete';
  previewData?: PanelData;
  readPreviewData?(): PanelData | undefined;
  timeRange?: { from: number; to: number };
  preview(query: DataQuery, options?: QueryPreviewSelection): boolean;
  peek?(query: DataQuery): boolean;
  stopPeek?(): void;
  accept(query: DataQuery): boolean;
  revert(): void;
}

export function QueryCoauthoringSurface({ adapter, host, onBaseline }: Props) {
  return (
    <QueryCoauthoringFailureBoundary
      adapter={adapter}
      onFailure={() => {
        host.revert();
        adapter.dismiss();
      }}
    >
      <QueryCoauthoringAdapterSubscriber adapter={adapter} host={host} onBaseline={onBaseline} />
    </QueryCoauthoringFailureBoundary>
  );
}

class QueryCoauthoringFailureBoundary extends Component<
  { adapter: QueryEditorCoauthoringAdapterV1; children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  private unsubscribeRecovery?: VoidFunction;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.unsubscribeRecovery?.();
    try {
      this.unsubscribeRecovery = this.props.adapter.subscribe(() => {
        this.unsubscribeRecovery?.();
        this.unsubscribeRecovery = undefined;
        this.setState({ failed: false });
      });
    } catch {
      this.unsubscribeRecovery = undefined;
    }
    this.props.onFailure();
  }

  componentDidUpdate(previousProps: Readonly<{ adapter: QueryEditorCoauthoringAdapterV1 }>) {
    if (previousProps.adapter !== this.props.adapter && this.state.failed) {
      this.unsubscribeRecovery?.();
      this.unsubscribeRecovery = undefined;
      this.setState({ failed: false });
    }
  }

  componentWillUnmount() {
    this.unsubscribeRecovery?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function QueryCoauthoringAdapterSubscriber(props: Props) {
  const { adapter } = props;
  const snapshot = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);

  return <QueryCoauthoringAdapterSurface {...props} snapshot={snapshot} />;
}

function QueryCoauthoringAdapterSurface({
  adapter,
  host,
  onBaseline,
  snapshot,
}: Props & { snapshot: QueryEditorCoauthoringSnapshotV1 }) {
  if (snapshot.mode === 'hidden') {
    return null;
  }

  if (snapshot.mode === 'selection') {
    return <QueryCoauthoringEntry adapter={adapter} portalTarget={snapshot.portalTarget} />;
  }

  return (
    <QueryCoauthoring
      key={snapshot.invocationId}
      adapter={adapter}
      invocationId={snapshot.invocationId}
      portalTarget={snapshot.portalTarget}
      onBaseline={onBaseline}
      datasourceType={host.datasourceType}
      onAccept={host.accept}
      onPreview={host.preview}
      onPeek={host.peek}
      onStopPeek={host.stopPeek}
      onRevertPreview={host.revert}
      previewData={host.previewData}
      readPreviewData={host.readPreviewData}
      isPreviewRunning={host.previewPhase === 'pending' || host.previewPhase === 'running'}
      timeRange={host.timeRange}
    />
  );
}

function QueryCoauthoringEntry({
  adapter,
  portalTarget,
}: {
  adapter: QueryEditorCoauthoringAdapterV1;
  portalTarget: HTMLElement;
}) {
  const styles = useStyles2(getStyles);
  const entryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onOutsidePointerDown = (event: PointerEvent) => {
      // Selection gestures in the owning editor must not dismiss the entry they reveal.
      const editor = portalTarget.closest('.monaco-editor');
      if (
        event.target instanceof Node &&
        !entryRef.current?.contains(event.target) &&
        !editor?.contains(event.target)
      ) {
        adapter.dismiss();
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        adapter.dismiss();
      }
    };
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutsidePointerDown, true);
      document.removeEventListener('keydown', onEscape);
    };
  }, [adapter, portalTarget]);
  const preserveSelection = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();
  return createPortal(
    <div
      ref={entryRef}
      className={styles.toolbarSurface}
      data-testid={selectors.components.QueryEditorCoauthoring.selectionToolbar}
    >
      <Button
        fill="text"
        icon="ai-sparkle"
        onClick={adapter.invoke}
        onMouseDown={preserveSelection}
        size="sm"
        variant="secondary"
      >
        {t('query-editor-coauthoring.explain-or-modify', 'Explain or modify')}
        <span className={styles.shortcut}>{getModKey()}+.</span>
      </Button>
    </div>,
    portalTarget
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    shortcut: css({
      marginLeft: theme.spacing(0.75),
      color: theme.colors.text.disabled,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
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
      boxShadow: theme.shadows.z2,
      overflow: 'hidden',
    }),
  };
}
