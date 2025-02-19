import { useMemo } from 'react';

import { Button, Stack, Text } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { TabItems } from './TabItems';

export function getEditOptions(_model: TabItems): OptionsPaneCategoryDescriptor[] {
  const tabOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard.edit-pane.tab.multi-select.options-header', 'Multi-selected Tab options'),
      id: 'ms-tab-options',
      isOpenDefault: true,
    });
  }, []);

  return [tabOptions];
}

export function renderActions(model: TabItems) {
  const tabs = model.getTabs();

  return (
    <Stack direction="column">
      <Text>
        <Trans i18nKey="dashboard.edit-pane.tab.multi-select.selection-number">No. of tabs selected: </Trans>
        {tabs.length}
      </Text>
      <Stack direction="row">
        <Button size="sm" variant="secondary" icon="copy" />
        <Button size="sm" variant="destructive" fill="outline" onClick={() => model.onDelete()} icon="trash-alt" />
      </Stack>
    </Stack>
  );
}
