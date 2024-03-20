import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { useToggle } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Button, CodeEditor, Drawer, Stack, useStyles2 } from '@grafana/ui';
import { TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

import { EditorColumnHeader } from '../contact-points/templates/EditorColumnHeader';

import { AlertInstanceModalSelector } from './AlertInstanceModalSelector';
import { AlertTemplatePreviewData } from './TemplateData';
import { TemplateDataTable } from './TemplateDataDocs';
import { GenerateAlertDataModal } from './form/GenerateAlertDataModal';

export const RESET_TO_DEFAULT = 'Reset to default';

export function PayloadEditor({
  payload,
  setPayload,
  defaultPayload,
  setPayloadFormatError,
  payloadFormatError,
  className,
}: {
  payload: string;
  defaultPayload: string;
  setPayload: React.Dispatch<React.SetStateAction<string>>;
  setPayloadFormatError: (value: React.SetStateAction<string | null>) => void;
  payloadFormatError: string | null;
  className?: string;
}) {
  const styles = useStyles2(getStyles);
  const onReset = () => {
    setPayload(defaultPayload);
  };

  const [cheatsheetOpened, toggleCheatsheetOpened] = useToggle(false);
  const [isEditingAlertData, setIsEditingAlertData] = useState(false);

  const onCloseEditAlertModal = () => {
    setIsEditingAlertData(false);
  };

  const errorInPayloadJson = payloadFormatError !== null;

  const validatePayload = () => {
    try {
      const payloadObj = JSON.parse(payload);
      JSON.stringify([...payloadObj]); // check if it's iterable, in order to be able to add more data
      setPayloadFormatError(null);
    } catch (e) {
      setPayloadFormatError(e instanceof Error ? e.message : 'Invalid JSON.');
      throw e;
    }
  };

  const onOpenEditAlertModal = () => {
    try {
      validatePayload();
      setIsEditingAlertData(true);
    } catch (e) {}
  };

  const onOpenAlertSelectorModal = () => {
    try {
      validatePayload();
      setIsAlertSelectorOpen(true);
    } catch (e) {}
  };

  const onAddAlertList = (alerts: TestTemplateAlert[]) => {
    onCloseEditAlertModal();
    setIsAlertSelectorOpen(false);
    setPayload((payload) => {
      const payloadObj = JSON.parse(payload);
      return JSON.stringify([...payloadObj, ...alerts], undefined, 2);
    });
  };

  const [isAlertSelectorOpen, setIsAlertSelectorOpen] = useState(false);

  return (
    <>
      <div className={cx(styles.wrapper, className)}>
        <EditorColumnHeader
          label="Payload"
          actions={
            <Button variant="secondary" fill="outline" size="sm" icon="info-circle" onClick={toggleCheatsheetOpened}>
              Cheatsheet
            </Button>
          }
        />

        <div className={styles.editorWrapper}>
          <AutoSizer>
            {({ width, height }) => (
              <CodeEditor
                containerStyles={styles.editorContainer}
                width={width}
                height={height}
                language={'json'}
                showLineNumbers={true}
                showMiniMap={false}
                value={payload}
                readOnly={false}
                onBlur={setPayload}
                monacoOptions={{ wordWrap: 'on' }}
              />
            )}
          </AutoSizer>
        </div>

        <Stack wrap="wrap" gap={0.5}>
          <Button
            type="button"
            variant="secondary"
            icon="bell"
            disabled={errorInPayloadJson}
            onClick={onOpenAlertSelectorModal}
          >
            Select alert instances
          </Button>

          <Button
            onClick={onOpenEditAlertModal}
            icon="plus-circle"
            type="button"
            variant="secondary"
            disabled={errorInPayloadJson}
          >
            Add custom alerts
          </Button>
          <Button onClick={onReset} icon="arrow-up" type="button" variant="destructive">
            {RESET_TO_DEFAULT}
          </Button>

          {payloadFormatError !== null && (
            <Badge
              color="orange"
              icon="exclamation-triangle"
              text={'JSON Error'}
              tooltip={'Fix errors in payload, and click Refresh preview button'}
            />
          )}
        </Stack>
      </div>

      {cheatsheetOpened && (
        <Drawer
          title="Alert template payload"
          subtitle="This is the list of alert data fields used in the preview."
          onClose={toggleCheatsheetOpened}
        >
          <AlertTemplateDataTable />
        </Drawer>
      )}

      <GenerateAlertDataModal isOpen={isEditingAlertData} onDismiss={onCloseEditAlertModal} onAccept={onAddAlertList} />

      <AlertInstanceModalSelector
        onSelect={onAddAlertList}
        isOpen={isAlertSelectorOpen}
        onClose={() => setIsAlertSelectorOpen(false)}
      />
    </>
  );
}
const AlertTemplateDataTable = () => {
  return <TemplateDataTable dataItems={AlertTemplatePreviewData} />;
};
const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
  tooltip: css`
    padding-left: ${theme.spacing(1)};
  `,
  label: css({
    margin: 0,
  }),
  editorWrapper: css({
    flex: 1,
    minHeight: theme.spacing(50),
  }),
  editorContainer: css({
    width: 'fit-content',
    border: 'none',
  }),
  templateDataDocsHeader: css`
    color: ${theme.colors.text.primary};

    span {
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
    }
  `,
});
