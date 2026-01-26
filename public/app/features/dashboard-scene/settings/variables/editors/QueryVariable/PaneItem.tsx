import { useState, useEffect } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { QueryVariable } from '@grafana/scenes';
import { TabsBar, Tab, Box, Button, Drawer, Stack } from '@grafana/ui';
import {
  QueryVariableStaticOptions,
  StaticOptionsOrderType,
  StaticOptionsType,
} from 'app/features/variables/query/QueryVariableStaticOptions';

import { VariableValuesPreview } from '../../components/VariableValuesPreview';
import { hasVariableOptions } from '../../utils';

import { Editor } from './QueryVariableEditor';

function useTabs({ variable }: { variable: QueryVariable }) {
  const [activeTab, setActiveTab] = useState('editor');

  useEffect(() => {
    if (activeTab === 'preview') {
      variable.refreshOptions();
    }
  }, [activeTab, variable]);

  const tabs = (
    <TabsBar>
      <Tab
        label={t('dashboard-scene.pane-item.tabs.label-query', 'Query')}
        active={activeTab === 'editor'}
        onChangeTab={(e) => {
          e.preventDefault();
          setActiveTab('editor');
        }}
      />
      <Tab
        label={t('dashboard-scene.pane-item.tabs.label-static-options', 'Static options')}
        active={activeTab === 'static-options'}
        onChangeTab={(e) => {
          e.preventDefault();
          setActiveTab('static-options');
        }}
      />
      <Tab
        label={t('dashboard-scene.pane-item.tabs.label-preview', 'Preview')}
        active={activeTab === 'preview'}
        onChangeTab={(e) => {
          e.preventDefault();
          setActiveTab('preview');
        }}
      />
    </TabsBar>
  );

  return {
    tabs,
    activeTab,
  };
}

export function PaneItem({ variable }: { variable: QueryVariable }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const onOpenEditor = () => setIsEditorOpen(true);
  const onCloseEditor = () => setIsEditorOpen(false);

  return (
    <>
      <Box display={'flex'} direction={'column'} paddingBottom={1}>
        <Button
          tooltip={t(
            'dashboard.edit-pane.variable.open-editor-tooltip',
            'For more variable options open variable editor'
          )}
          onClick={onOpenEditor}
          size="sm"
          fullWidth
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsOpenButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.open-editor">Open variable editor</Trans>
        </Button>
      </Box>
      {isEditorOpen && <EditorDrawer variable={variable} onClose={onCloseEditor} />}
    </>
  );
}

function EditorDrawer({ variable, onClose }: { variable: QueryVariable; onClose: () => void }) {
  const { tabs, activeTab } = useTabs({ variable });

  const { options, staticOptions, staticOptionsOrder } = variable.useState();
  const onStaticOptionsChange = (staticOptions: StaticOptionsType) => {
    variable.setState({ staticOptions });
  };
  const onStaticOptionsOrderChange = (staticOptionsOrder: StaticOptionsOrderType) => {
    variable.setState({ staticOptionsOrder });
  };

  return (
    <Drawer
      title={t('dashboard-scene.modal-editor.title-variable-editor', 'Variable editor')}
      subtitle={variable.state.name}
      size="lg"
      onClose={onClose}
      closeOnMaskClick={false}
      tabs={tabs}
    >
      {activeTab === 'editor' && <Editor variable={variable} />}
      {activeTab === 'static-options' && (
        <QueryVariableStaticOptions
          options={options}
          staticOptions={staticOptions}
          staticOptionsOrder={staticOptionsOrder}
          onStaticOptionsChange={onStaticOptionsChange}
          onStaticOptionsOrderChange={onStaticOptionsOrderChange}
        />
      )}
      {activeTab === 'preview' && hasVariableOptions(variable) && (
        <VariableValuesPreview options={variable.getOptionsForSelect(false)} />
      )}
      <div style={{ marginTop: '16px' }}>
        <Stack direction="row" gap={2}>
          <Button
            variant="primary"
            // onClick={onSaveOptions}
            data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.applyButton}
          >
            <Trans i18nKey="dashboard.edit-pane.variable.custom-options.apply">Apply</Trans>
          </Button>
          <Button
            variant="secondary"
            fill="outline"
            onClick={onClose}
            data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.closeButton}
          >
            <Trans i18nKey="dashboard.edit-pane.variable.custom-options.discard">Discard</Trans>
          </Button>
        </Stack>
      </div>
    </Drawer>
  );
}
