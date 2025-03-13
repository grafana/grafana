import { css, cx } from '@emotion/css';
import { useState } from 'react';
import * as React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, CodeEditor, Dropdown, Menu, Stack, Toggletip, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

import { EditorColumnHeader } from '../contact-points/templates/EditorColumnHeader';

import { AlertInstanceModalSelector } from './AlertInstanceModalSelector';
import { AlertTemplatePreviewData } from './TemplateData';
import { TemplateDataTable } from './TemplateDataDocs';
import { GenerateAlertDataModal } from './form/GenerateAlertDataModal';

export const RESET_TO_DEFAULT = 'Reset to defaults';

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
          label={t('alerting.payload-editor.label-payload', 'Payload')}
          actions={
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Dropdown
                overlay={
                  <Menu>
                    <Menu.Item
                      label={t(
                        'alerting.payload-editor.label-use-existing-alert-instances',
                        'Use existing alert instances'
                      )}
                      disabled={errorInPayloadJson}
                      onClick={onOpenAlertSelectorModal}
                    />
                    <Menu.Item
                      label={t('alerting.payload-editor.label-add-custom-alert-instance', 'Add custom alert instance')}
                      disabled={errorInPayloadJson}
                      onClick={onOpenEditAlertModal}
                    />
                    <Menu.Divider />
                    <Menu.Item label={RESET_TO_DEFAULT} onClick={onReset} destructive />
                  </Menu>
                }
              >
                <Button variant="secondary" size="sm" icon="angle-down">
                  <Trans i18nKey="alerting.payload-editor.edit-payload">Edit payload</Trans>
                </Button>
              </Dropdown>
              <Toggletip content={<AlertTemplateDataTable />} placement="top" fitContent>
                <Button variant="secondary" fill="outline" size="sm" icon="question-circle">
                  <Trans i18nKey="alerting.payload-editor.reference">Reference</Trans>
                </Button>
              </Toggletip>
            </Stack>
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
                monacoOptions={{
                  scrollBeyondLastLine: false,
                }}
              />
            )}
          </AutoSizer>
        </div>
      </div>

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
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  }),
  tooltip: css({
    paddingLeft: theme.spacing(1),
  }),
  label: css({
    margin: 0,
  }),
  editorWrapper: css({
    flex: 1,
  }),
  editorContainer: css({
    width: 'fit-content',
    border: 'none',
  }),
  templateDataDocsHeader: css({
    color: theme.colors.text.primary,

    span: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    },
  }),
});
