import { FormEvent, useState } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, MetricFindValue, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, SceneVariable } from '@grafana/scenes';

import { AdHocVariableForm } from '../components/AdHocVariableForm';
import { Box, Button, Modal } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { Trans } from 'react-i18next';
import { t } from '@grafana/i18n/internal';
import { noop } from 'lodash';

interface AdHocFiltersVariableEditorProps {
  variable: AdHocFiltersVariable;
  onRunQuery: (variable: AdHocFiltersVariable) => void;
  inline?: boolean;
}

export function AdHocFiltersVariableEditor(props: AdHocFiltersVariableEditorProps) {
  const { variable } = props;
  const { datasource: datasourceRef, defaultKeys, allowCustomValue } = variable.useState();

  const { value: datasourceSettings } = useAsync(async () => {
    return await getDataSourceSrv().get(datasourceRef);
  }, [datasourceRef]);

  const message = datasourceSettings?.getTagKeys
    ? 'Ad hoc filters are applied automatically to all queries that target this data source'
    : 'This data source does not support ad hoc filters yet.';

  const onDataSourceChange = (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);

    variable.setState({
      datasource: dsRef,
      supportsMultiValueOperators: ds.meta.multiValueFilterOperators,
    });
  };

  const onDefaultKeysChange = (defaultKeys?: MetricFindValue[]) => {
    variable.setState({
      defaultKeys,
    });
  };

  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };

  return (
    <AdHocVariableForm
      datasource={datasourceRef ?? undefined}
      infoText={message}
      allowCustomValue={allowCustomValue}
      onDataSourceChange={onDataSourceChange}
      defaultKeys={defaultKeys}
      onDefaultKeysChange={onDefaultKeysChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
      inline={props.inline}
    />
  );
}

export function getAdHocFilterOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof AdHocFiltersVariable)) {
    console.warn('getAdHocFilterOptions: variable is not an AdHocFiltersVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      render: () => <ModalEditor variable={variable} />,
    }),
  ];
}

export function ModalEditor({ variable }: { variable: AdHocFiltersVariable }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Box display={'flex'} direction={'column'} paddingBottom={1}>
        <Button
          tooltip={t(
            'dashboard.edit-pane.variable.open-editor-tooltip',
            'For more variable options open variable editor'
          )}
          onClick={() => setIsOpen(true)}
          size="sm"
          fullWidth
        >
          <Trans i18nKey="dashboard.edit-pane.variable.open-editor">Open variable editor</Trans>
        </Button>
      </Box>
      <Modal
        title={t('dashboard.edit-pane.variable.adhoc-options.modal-title', 'Ad Hoc Variable')}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
      >
        <AdHocFiltersVariableEditor variable={variable} onRunQuery={noop} inline={true}/>
        <Modal.ButtonRow>
          <Button variant="secondary" fill="outline" onClick={() => setIsOpen(false)}>
            <Trans i18nKey="dashboard.edit-pane.variable.modal-options.close">Close</Trans>
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}
