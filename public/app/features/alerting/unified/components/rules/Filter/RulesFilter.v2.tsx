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
      <Label>Search</Label>
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
        <Label>Folder / Namespace</Label>
        <Select options={[]} onChange={() => {}}></Select>
        <Label>Alert rule name</Label>
        <Input />
        <Label>Evaluation group</Label>
        <Input />
        <Label>Labels</Label>
        <Input />
        <Label>Data source</Label>
        <Select options={[]} onChange={() => {}}></Select>
        <Label>State</Label>
        <RadioButtonGroup
          value={'*'}
          options={[
            { label: 'All', value: '*' },
            { label: 'Normal', value: 'normal' },
            { label: 'Pending', value: 'pending' },
            { label: 'Firing', value: 'firing' },
          ]}
        />
        <Label>Type</Label>
        <RadioButtonGroup
          value={'*'}
          options={[
            { label: 'All', value: '*' },
            { label: 'Alert rule', value: 'alerting' },
            { label: 'Recording rule', value: 'recording' },
          ]}
        />
        <Label>Health</Label>
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
        <Button variant="secondary">Clear</Button>
        <Button>Apply</Button>
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
          Save current search
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
                    Apply
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
        <Button variant="secondary">Close</Button>
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
