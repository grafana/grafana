import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, ConfirmModal, Icon, IconButton, Input, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';

import { canCreateNotebooks } from '../permissions';

import { promoteScratchpad } from './promoteScratchpad';
import { setScratchpadOpen } from './scratchpadOpen';
import {
  addNote,
  clearScratchpad,
  isHeading,
  moveBlock,
  removeBlock,
  setTitle,
  toggleHeading,
  updateText,
  useScratchpad,
  type ScratchBlock,
} from './scratchpadStore';

interface Props {
  onClose: () => void;
}

export function ScratchpadPanel({ onClose }: Props) {
  const styles = useStyles2(getStyles);
  const { title, blocks } = useScratchpad();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const canCreate = canCreateNotebooks();

  // Quick-add elsewhere only offers the scratchpad while it is docked; the panel only mounts then.
  useEffect(() => {
    setScratchpadOpen(true);
    return () => setScratchpadOpen(false);
  }, []);

  const submitNote = () => {
    if (!note.trim()) {
      return;
    }
    addNote(note);
    setNote('');
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submitNote();
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (result.destination && result.destination.index !== result.source.index) {
      moveBlock(result.source.index, result.destination.index);
    }
  };

  const onSave = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await promoteScratchpad();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('notebooks.scratchpad.save-error', 'Could not save'));
      setSaving(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Stack direction="column" gap={0} flex={1} minWidth={0}>
          <Text element="h2" variant="h5">
            <Trans i18nKey="notebooks.scratchpad.title">Scratchpad</Trans>
          </Text>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="notebooks.scratchpad.private-hint">Private draft, only saved on this browser</Trans>
          </Text>
        </Stack>
        <IconButton name="times" aria-label={t('notebooks.scratchpad.close', 'Close scratchpad')} onClick={onClose} />
      </div>

      <div className={styles.titleRow}>
        <Input
          value={title}
          placeholder={t('notebooks.scratchpad.title-placeholder', 'Name your notebook (optional)')}
          aria-label={t('notebooks.scratchpad.title-label', 'Notebook name')}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </div>

      <div className={styles.list} ref={listRef}>
        {blocks.length === 0 ? (
          <div className={styles.empty}>
            <Icon name="book" size="xl" />
            <Text color="secondary" textAlignment="center">
              <Trans i18nKey="notebooks.scratchpad.empty">
                Jot down notes or add panels from dashboards and Explore. Save it as a notebook when it is ready.
              </Trans>
            </Text>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="scratchpad-blocks">
              {(drop) => (
                <div ref={drop.innerRef} {...drop.droppableProps} className={styles.blocks}>
                  {blocks.map((block, index) => (
                    <Draggable key={block.id} draggableId={block.id} index={index}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={snapshot.isDragging ? styles.rowDragging : styles.row}
                        >
                          <div
                            {...drag.dragHandleProps}
                            className={styles.handle}
                            aria-label={t('notebooks.scratchpad.drag', 'Drag to reorder')}
                          >
                            <Icon name="draggabledots" />
                          </div>
                          <ScratchBlockContent block={block} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {drop.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      <div className={styles.footer}>
        <TextArea
          value={note}
          rows={3}
          aria-label={t('notebooks.scratchpad.note-label', 'Add a note')}
          placeholder={t('notebooks.scratchpad.note-placeholder', 'Add some text…')}
          onChange={(e) => setNote(e.currentTarget.value)}
          onKeyDown={onComposerKeyDown}
        />
        <Button fullWidth variant="secondary" icon="plus" disabled={!note.trim()} onClick={submitNote}>
          <Trans i18nKey="notebooks.scratchpad.add-note">Add note</Trans>
        </Button>

        {error && (
          <Alert severity="error" title={t('notebooks.scratchpad.save-failed', 'Could not save as notebook')}>
            {error}
          </Alert>
        )}

        <Stack gap={1}>
          <Button
            fullWidth
            icon="save"
            disabled={blocks.length === 0 || saving || !canCreate}
            tooltip={canCreate ? undefined : t('notebooks.scratchpad.no-create', 'You cannot create notebooks')}
            onClick={onSave}
          >
            {saving ? (
              <Trans i18nKey="notebooks.scratchpad.saving">Saving…</Trans>
            ) : (
              <Trans i18nKey="notebooks.scratchpad.save">Save as notebook</Trans>
            )}
          </Button>
          <IconButton
            name="trash-alt"
            size="lg"
            disabled={blocks.length === 0 && !title}
            aria-label={t('notebooks.scratchpad.clear', 'Discard scratchpad')}
            onClick={() => setConfirmingClear(true)}
          />
        </Stack>
      </div>
      <ConfirmModal
        isOpen={confirmingClear}
        title={t('notebooks.scratchpad.discard-title', 'Discard scratchpad')}
        body={t(
          'notebooks.scratchpad.discard-body',
          'Are you sure you want to discard this scratchpad? Everything in it will be lost.'
        )}
        confirmText={t('notebooks.scratchpad.discard-confirm', 'Discard')}
        onConfirm={() => {
          clearScratchpad();
          setConfirmingClear(false);
        }}
        onDismiss={() => setConfirmingClear(false)}
      />
    </div>
  );
}

function ScratchBlockContent({ block }: { block: ScratchBlock }) {
  const styles = useStyles2(getStyles);

  if (block.kind === 'panel') {
    const vizType = block.panel.kind === 'Panel' ? block.panel.spec.vizConfig.group : undefined;
    return (
      <div className={styles.content}>
        <div className={styles.panelCard}>
          <Icon name="graph-bar" />
          <Stack direction="column" gap={0} minWidth={0}>
            <Text truncate>{block.panel.spec.title || t('notebooks.scratchpad.untitled-panel', 'Untitled panel')}</Text>
            {vizType && (
              <Text variant="bodySmall" color="secondary">
                {vizType}
              </Text>
            )}
          </Stack>
        </div>
        <RemoveButton id={block.id} />
      </div>
    );
  }

  const heading = isHeading(block.text);
  return (
    <div className={styles.content}>
      <TextArea
        className={heading ? styles.headingText : undefined}
        value={block.text}
        rows={Math.max(1, Math.min(8, block.text.split('\n').length))}
        aria-label={t('notebooks.scratchpad.block-text', 'Text block')}
        onChange={(e) => updateText(block.id, e.currentTarget.value)}
      />
      <Stack direction="row" gap={0.5} alignItems="center">
        <IconButton
          name="text-fields"
          variant={heading ? 'primary' : 'secondary'}
          aria-pressed={heading}
          tooltip={
            heading
              ? t('notebooks.scratchpad.make-paragraph', 'Make paragraph')
              : t('notebooks.scratchpad.make-heading', 'Make heading')
          }
          onClick={() => toggleHeading(block.id)}
        />
        <RemoveButton id={block.id} />
      </Stack>
    </div>
  );
}

function RemoveButton({ id }: { id: string }) {
  return (
    <IconButton
      name="trash-alt"
      tooltip={t('notebooks.scratchpad.remove', 'Remove block')}
      onClick={() => removeBlock(id)}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const row = {
    display: 'flex',
    alignItems: 'stretch',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  } as const;

  return {
    root: css({ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    titleRow: css({ padding: theme.spacing(1, 2, 0) }),
    list: css({ flex: 1, minHeight: 0, overflow: 'auto', padding: theme.spacing(2) }),
    blocks: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1) }),
    row: css(row),
    rowDragging: css(row, { boxShadow: theme.shadows.z3 }),
    handle: css({ display: 'flex', alignItems: 'center', color: theme.colors.text.secondary, cursor: 'grab' }),
    content: css({ display: 'flex', flex: 1, minWidth: 0, gap: theme.spacing(1), alignItems: 'stretch' }),
    panelCard: css({
      display: 'flex',
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    }),
    headingText: css({ fontSize: theme.typography.h4.fontSize, fontWeight: theme.typography.fontWeightMedium }),
    empty: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(4, 2),
      color: theme.colors.text.secondary,
    }),
    footer: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(2),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
  };
};
