import { css } from '@emotion/css';
import { Component, type MouseEvent, type ReactNode, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Button, useStyles2 } from '@grafana/ui';
import { getModKey } from 'app/core/utils/browser';

import { QueryCoauthoring } from './QueryCoauthoring';
import { useQueryCoauthoringHost } from './QueryCoauthoringHostContext';
import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringSnapshotV1,
} from './internalCoauthoringContract';

interface Props {
  adapter: QueryEditorCoauthoringAdapterV1;
  onBaseline: (query: DataQuery) => boolean;
}

export function QueryCoauthoringSurface({ adapter, onBaseline }: Props) {
  const host = useQueryCoauthoringHost();
  const snapshot = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);

  return (
    <QueryCoauthoringFailureBoundary
      adapter={adapter}
      snapshotKey={getSnapshotKey(snapshot)}
      onFailure={() => {
        host.revert();
        adapter.dismiss();
      }}
    >
      <QueryCoauthoringAdapterSurface adapter={adapter} onBaseline={onBaseline} snapshot={snapshot} />
    </QueryCoauthoringFailureBoundary>
  );
}

class QueryCoauthoringFailureBoundary extends Component<
  { adapter: object; children: ReactNode; onFailure: () => void; snapshotKey: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  componentDidUpdate(previousProps: Readonly<{ adapter: object; snapshotKey: string }>) {
    if (
      (previousProps.adapter !== this.props.adapter || previousProps.snapshotKey !== this.props.snapshotKey) &&
      this.state.failed
    ) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function QueryCoauthoringAdapterSurface({
  adapter,
  onBaseline,
  snapshot,
}: Props & { snapshot: QueryEditorCoauthoringSnapshotV1 }) {
  const host = useQueryCoauthoringHost();
  const styles = useStyles2(getStyles);

  if (snapshot.mode === 'hidden') {
    return null;
  }

  if (snapshot.mode === 'selection') {
    const preserveSelection = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();
    return createPortal(
      <div className={styles.toolbarSurface} data-testid="query-coauthoring-selection-toolbar">
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
      snapshot.portalTarget
    );
  }

  return (
    <QueryCoauthoring
      adapter={adapter}
      invocationId={snapshot.invocationId}
      portalTarget={snapshot.portalTarget}
      onBaseline={onBaseline}
      datasourceType={host.datasourceType}
      onAccept={host.accept}
      onPreview={host.preview}
      onRevertPreview={host.revert}
      isPreviewRunning={host.previewPhase === 'pending' || host.previewPhase === 'running'}
      timeRange={host.timeRange}
    />
  );
}

function getSnapshotKey(snapshot: QueryEditorCoauthoringSnapshotV1): string {
  return snapshot.mode === 'invoked' ? `invoked:${snapshot.invocationId}` : snapshot.mode;
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
