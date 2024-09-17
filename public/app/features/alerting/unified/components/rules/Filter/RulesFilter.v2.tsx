import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Badge,
  Button,
  Grid,
  IconButton,
  Input,
  InteractiveTable,
  Label,
  RadioButtonGroup,
  Select,
  Stack,
  Tab,
  TabsBar,
  useStyles2,
} from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { PopupCard } from '../../HoverCard';
import MoreButton from '../../MoreButton';

type RulesFilterProps = {
  onClear?: () => void;
};

type ActiveTab = 'custom' | 'saved';

export default function RulesFilter({ onClear = () => {} }: RulesFilterProps) {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState<ActiveTab>('custom');

  const filterOptions = useMemo(() => {
    return (
      <PopupCard
        showOn="click"
        placement="bottom-start"
        content={
          <div className={styles.content}>
            {activeTab === 'custom' && <FilterOptions />}
            {activeTab === 'saved' && <SavedSearches />}
          </div>
        }
        header={
          <TabsBar hideBorder className={styles.fixTabsMargin}>
            <Tab
              active={activeTab === 'custom'}
              icon="filter"
              label={'Custom filter'}
              onChangeTab={() => setActiveTab('custom')}
            />
            <Tab
              active={activeTab === 'saved'}
              icon="bookmark"
              label={'Saved searches'}
              onChangeTab={() => setActiveTab('saved')}
            />
          </TabsBar>
        }
      >
        <IconButton name="filter" aria-label="Show filters" />
      </PopupCard>
    );
  }, [activeTab, styles.content, styles.fixTabsMargin]);

  return (
    <Stack direction="column" gap={0}>
      <Label>
        <Trans i18nKey="common.search">Search</Trans>
      </Label>
      <Stack direction="row">
        <Input prefix={filterOptions} />
      </Stack>
    </Stack>
  );
}

const FilterOptions = () => {
  return (
    <Stack direction="column" alignItems="end" gap={2}>
      <Grid columns={2} gap={2} alignItems="center">
        <Label>
          <Trans i18nKey="alerting.search.property.namespace">Folder / Namespace</Trans>
        </Label>
        <Select options={[]} onChange={() => {}}></Select>
        <Label>
          <Trans i18nKey="alerting.search.property.rule-name">Alerting rule name</Trans>
        </Label>
        <Input />
        <Label>
          <Trans i18nKey="alerting.search.property.evaluation-group">Evaluation group</Trans>
        </Label>
        <Input />
        <Label>
          <Trans i18nKey="alerting.search.property.labels">Labels</Trans>
        </Label>
        <Input />
        <Label>
          <Trans i18nKey="alerting.search.property.data-source">Data source</Trans>
        </Label>
        <Select options={[]} onChange={() => {}}></Select>
        <Label>
          <Trans i18nKey="alerting.search.property.state">State</Trans>
        </Label>
        <RadioButtonGroup
          value={'*'}
          options={[
            { label: 'All', value: '*' },
            { label: 'Normal', value: 'normal' },
            { label: 'Pending', value: 'pending' },
            { label: 'Firing', value: 'firing' },
          ]}
        />
        <Label>
          <Trans i18nKey="alerting.search.property.rule-type">Type</Trans>
        </Label>
        <RadioButtonGroup
          value={'*'}
          options={[
            { label: 'All', value: '*' },
            { label: 'Alert rule', value: 'alerting' },
            { label: 'Recording rule', value: 'recording' },
          ]}
        />
        <Label>
          <Trans i18nKey="alerting.search.property.rule-health">Health</Trans>
        </Label>
        <RadioButtonGroup
          value={'*'}
          options={[
            { label: 'All', value: '*' },
            { label: 'OK', value: 'ok' },
            { label: 'No data', value: 'no_data' },
            { label: 'Error', value: 'error' },
          ]}
        />
      </Grid>
      <Stack direction="row" alignItems="center">
        <Button variant="secondary">
          <Trans i18nKey="common.clear">Clear</Trans>
        </Button>
        <Button>
          <Trans i18nKey="common.apply">Apply</Trans>
        </Button>
      </Stack>
    </Stack>
  );
};

type TableColumns = {
  name: string;
  default?: boolean;
};

const SavedSearches = () => {
  const applySearch = useCallback((name: string) => {}, []);

  return (
    <>
      <Stack direction="column" gap={2} alignItems="flex-end">
        <Button variant="secondary" size="sm">
          <Trans i18nKey="alerting.search.save-query">Save current search</Trans>
        </Button>
        <InteractiveTable<TableColumns>
          columns={[
            {
              id: 'name',
              header: 'Saved search name',
              cell: ({ row }) => (
                <Stack alignItems="center">
                  {row.original.name}
                  {row.original.default ? <Badge text="Default" color="blue" /> : null}
                </Stack>
              ),
            },
            {
              id: 'actions',
              cell: ({ row }) => (
                <Stack direction="row" alignItems="center">
                  <Button variant="secondary" fill="outline" size="sm" onClick={() => applySearch(row.original.name)}>
                    <Trans i18nKey="common.apply">Apply</Trans>
                  </Button>
                  <MoreButton size="sm" fill="outline" />
                </Stack>
              ),
            },
          ]}
          data={[
            {
              name: 'My saved search',
              default: true,
            },
            {
              name: 'Another saved search',
            },
            {
              name: 'This one has a really long name and some emojis too 🥒',
            },
          ]}
          getRowId={(row) => row.name}
        />
        <Button variant="secondary">
          <Trans i18nKey="common.close">Close</Trans>
        </Button>
      </Stack>
    </>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    content: css({
      padding: theme.spacing(1),
      maxWidth: 500,
    }),
    fixTabsMargin: css({
      marginTop: theme.spacing(-1),
    }),
  };
}
