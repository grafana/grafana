import { rangeUtil, type PanelData } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { Alert, Button, Icon, IconButton, Input, Stack, Text, TimeRangeInput } from '@grafana/ui';

import {
  clearCellTimeOverride,
  setCellHeight,
  setCellTimeOverride,
  updateCodeCell,
  updateMarkdownText,
  updatePanelQuery,
  updatePanelTitle,
  type ResolvedCell,
} from '../model/notebookSpec';
import { formatLockedRange, rawToString } from '../model/timeFormat';

import { CodeCellEditor } from './cells/CodeCellEditor';
import { MarkdownCellEditor } from './cells/MarkdownCellEditor';
import { PanelCellView } from './cells/PanelCellView';
import { PanelQueryEditor } from './cells/PanelQueryEditor';

export interface CellBodyProps {
  cell: ResolvedCell;
  spec: NotebookSpec;
  index: number;
  editing: boolean;
  renaming: boolean;
  timeEditing: boolean;
  queryEditing: boolean;
  refreshNonce: number;
  onStartEdit: () => void;
  onDoneEdit: () => void;
  onDoneRename: () => void;
  onDoneTimeEdit: () => void;
  onDoneQueryEdit: () => void;
  getPanelData: () => PanelData | undefined;
  onRegisterDataReader: (getData: () => PanelData | undefined) => void;
  onPreferredViz: (pluginId: string) => void;
  onQueryApplied: () => void;
  update: (mutate: (spec: NotebookSpec) => NotebookSpec, activity?: { label: string; cellKey?: string }) => void;
}

/**
 * The type-specific body of one notebook block: a live panel (with rename, time
 * lock and inline query editing), editable markdown, or an editable code snippet.
 */
export function NotebookCellBody({
  cell,
  spec,
  index,
  editing,
  renaming,
  timeEditing,
  queryEditing,
  refreshNonce,
  onStartEdit,
  onDoneEdit,
  onDoneRename,
  onDoneTimeEdit,
  onDoneQueryEdit,
  getPanelData,
  onRegisterDataReader,
  onPreferredViz,
  onQueryApplied,
  update,
}: CellBodyProps) {
  const { element, elementName } = cell;

  if (element.kind === 'Panel') {
    const commitRename = (value: string) => {
      update((s) => updatePanelTitle(s, elementName, value), {
        label: t('notebooks.activity.renamed-panel', 'renamed a panel'),
        cellKey: elementName,
      });
      onDoneRename();
    };

    const isLocked = Boolean(cell.timeFrom && cell.timeTo);
    const effectiveFrom = cell.timeFrom ?? spec.timeSettings.from;
    const effectiveTo = cell.timeTo ?? spec.timeSettings.to;

    return (
      <>
        {renaming && (
          <Input
            autoFocus
            defaultValue={element.spec.title}
            aria-label={t('notebooks.cell.rename-label', 'Panel title')}
            onBlur={(e) => commitRename(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitRename(e.currentTarget.value);
              }
              if (e.key === 'Escape') {
                onDoneTimeEdit();
                onDoneRename();
              }
            }}
          />
        )}
        {timeEditing && (
          <Stack direction="row" gap={1} alignItems="center">
            <TimeRangeInput
              value={rangeUtil.convertRawToRange({ from: effectiveFrom, to: effectiveTo })}
              onChange={(tr) => {
                update((s) => setCellTimeOverride(s, index, rawToString(tr.raw.from), rawToString(tr.raw.to)), {
                  label: t('notebooks.activity.locked-time', 'locked a block to a time range'),
                  cellKey: elementName,
                });
                onDoneTimeEdit();
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              fill="outline"
              onClick={() => {
                update((s) => clearCellTimeOverride(s, index), {
                  label: t('notebooks.activity.unlocked-time', 'synced a block back to notebook time'),
                  cellKey: elementName,
                });
                onDoneTimeEdit();
              }}
            >
              <Trans i18nKey="notebooks.cell.time-sync">Use notebook time</Trans>
            </Button>
            <IconButton name="times" tooltip={t('notebooks.cell.time-close', 'Close')} onClick={onDoneTimeEdit} />
          </Stack>
        )}
        {isLocked && !timeEditing && (
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon name="lock" size="xs" />
            <Text variant="bodySmall" color="secondary">
              {t('notebooks.cell.locked-range', 'Locked: {{range}}', {
                range: formatLockedRange(cell.timeFrom!, cell.timeTo!),
              })}
            </Text>
            <IconButton
              name="times"
              size="sm"
              tooltip={t('notebooks.cell.unlock', 'Sync back to notebook time range')}
              onClick={() =>
                update((s) => clearCellTimeOverride(s, index), {
                  label: t('notebooks.activity.unlocked-time', 'synced a block back to notebook time'),
                  cellKey: elementName,
                })
              }
            />
          </Stack>
        )}
        {queryEditing && (
          <PanelQueryEditor
            panel={element}
            timeFrom={effectiveFrom}
            timeTo={effectiveTo}
            getData={getPanelData}
            onApply={(refId, query, datasource) => {
              update((s) => updatePanelQuery(s, elementName, refId, { ...query }, datasource), {
                label: t('notebooks.activity.edited-query', 'edited a query'),
                cellKey: elementName,
              });
              onQueryApplied();
            }}
            onClose={onDoneQueryEdit}
          />
        )}
        <PanelCellView
          panel={element}
          timeFrom={effectiveFrom}
          timeTo={effectiveTo}
          refreshNonce={refreshNonce}
          height={cell.height}
          onHeightChange={(height) => update((s) => setCellHeight(s, index, height))}
          onDataReaderReady={onRegisterDataReader}
          onPreferredViz={onPreferredViz}
          revertUserTimeChanges={isLocked}
          onUserTimeChange={(from, to) =>
            update((s) => setCellTimeOverride(s, index, from, to), {
              label: t('notebooks.activity.locked-time', 'locked a block to a time range'),
              cellKey: elementName,
            })
          }
        />
      </>
    );
  }

  if (element.kind === 'LibraryPanel') {
    return (
      <Alert
        severity="info"
        title={t('notebooks.editor.library-panel', 'Library panel — open the notebook view to render it')}
      />
    );
  }

  const content = element.spec.content;
  if (content.kind === 'Markdown') {
    return (
      <MarkdownCellEditor
        value={content.spec.text}
        editing={editing}
        onStartEdit={onStartEdit}
        onChange={(text) => update((s) => updateMarkdownText(s, elementName, text))}
        onDone={onDoneEdit}
      />
    );
  }

  return (
    <CodeCellEditor
      code={content.spec.code}
      language={content.spec.language}
      editing={editing}
      onStartEdit={onStartEdit}
      onChange={(changes) => update((s) => updateCodeCell(s, elementName, changes))}
      onDone={onDoneEdit}
    />
  );
}
