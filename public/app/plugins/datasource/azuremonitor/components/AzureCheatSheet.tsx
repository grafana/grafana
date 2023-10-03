import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import {
  Button,
  Card,
  Collapse,
  CustomScrollbar,
  InlineField,
  Input,
  LoadingPlaceholder,
  Select,
  useStyles2,
} from '@grafana/ui';

import tokenizer from '../../cloudwatch/language/cloudwatch-logs/syntax';
import { RawQuery } from '../../prometheus/querybuilder/shared/RawQuery';
import { AzureMonitorQuery, AzureQueryType } from '../types';

type Category = {
  displayName: string;
  id: string;
  related: {
    queries: string[];
    tables: string[];
  };
};

type CheatsheetQuery = {
  body: string;
  description: string;
  displayName: string;
  id: string;
  properties: {
    ExampleQuery: boolean;
    QueryAttributes: {
      isMultiResource: boolean;
    };
  };
  related: {
    categories: string[];
    resourceTypes: string[];
    tables: string[];
  };
  tags: {
    Topic: string[];
  };
};

type CheatsheetQueries = {
  Security?: CheatsheetQuery[] | [];
  Management?: CheatsheetQuery[] | [];
  Virtualmachines?: CheatsheetQuery[] | [];
  Container?: CheatsheetQuery[] | [];
  Audit?: CheatsheetQuery[] | [];
  Workloads?: CheatsheetQuery[] | [];
  Resources?: CheatsheetQuery[] | [];
  Applications?: CheatsheetQuery[] | [];
  Monitor?: CheatsheetQuery[] | [];
  Databases?: CheatsheetQuery[] | [];
  Windowsvirtualdesktop?: CheatsheetQuery[] | [];
};

type DropdownCategories = {
  Logs: boolean;
  Security: boolean;
  Management: boolean;
  Virtualmachines: boolean;
  Container: boolean;
  Audit: boolean;
  Workloads: boolean;
  Resources: boolean;
  Applications: boolean;
  Monitor: boolean;
  Databases: boolean;
  Windowsvirtualdesktop: boolean;
};

type Props = {
  onClickExample: (query: AzureMonitorQuery) => void;
  query: AzureMonitorQuery;
};

const AzureCheatSheet = (props: Props) => {
  const [cheatsheetQueries, setCheatsheetQueries] = useState<CheatsheetQueries | null>(null);
  const [areDropdownsOpen, setAreDropdownsOpen] = useState<DropdownCategories>({
    Logs: false,
    Security: false,
    Management: false,
    Virtualmachines: false,
    Container: false,
    Audit: false,
    Workloads: false,
    Resources: false,
    Applications: false,
    Monitor: false,
    Databases: false,
    Windowsvirtualdesktop: false,
  });
  const [visibleQueries, setVisibleQueries] = useState<CheatsheetQueries | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInputValue, setSearchInputValue] = useState('');
  const styles = useStyles2(getStyles);
  const lang = { grammar: tokenizer, name: 'kql' };
  const dropdownMenu = useMemo(() => {
    if (cheatsheetQueries) {
      return Object.keys(cheatsheetQueries).map((category) => {
        return {
          label: category,
          value: category,
        };
      });
    }
    return [];
  }, [cheatsheetQueries]);

  const getCheatsheetQueries = async () => {
    await getBackendSrv()
      .get(`https://api.loganalytics.io/v1/metadata`)
      .then((result) => {
        result.categories.sort((a: Category, b: Category) => {
          return a.displayName.toLowerCase() === b.displayName.toLowerCase()
            ? 0
            : a.displayName.toLowerCase() < b.displayName.toLowerCase()
            ? -1
            : 1;
        });
        const categorizedQueries = result.categories.reduce(
          (queriesByCategory: CheatsheetQueries, category: Category) => {
            const categoryQueries = category.related.queries.map((queryId: string) => {
              return result.queries.find((query: CheatsheetQuery) => query.id === queryId);
            });
            queriesByCategory[category.displayName as keyof CheatsheetQueries] = categoryQueries;
            setAreDropdownsOpen({ ...areDropdownsOpen, [category.id]: false });
            return queriesByCategory;
          },
          {}
        );
        setCheatsheetQueries(categorizedQueries);
        setVisibleQueries(categorizedQueries);
        setIsLoading(false);
        return categorizedQueries;
      });
  };

  useEffect(() => {
    if (!cheatsheetQueries) {
      getCheatsheetQueries();
    }
  });

  // TODO: feature tracking on kick start your query and use this query button
  const filterQueriesBySearch = (searchValue: string) => {
    if (searchValue.length > 0 && cheatsheetQueries) {
      const filteredQueries: CheatsheetQueries = Object.keys(cheatsheetQueries).reduce(
        (filteredQueriesBySearch: CheatsheetQueries, category) => {
          const filters = cheatsheetQueries[category as keyof CheatsheetQueries]!.filter((query) => {
            return query.displayName.toLowerCase().includes(searchValue.toLowerCase());
          });
          filteredQueriesBySearch[category as keyof CheatsheetQueries] = filters;
          return filteredQueriesBySearch;
        },
        {
          Security: [],
          Management: [],
          Virtualmachines: [],
          Container: [],
          Audit: [],
          Workloads: [],
          Resources: [],
          Applications: [],
          Monitor: [],
          Databases: [],
          Windowsvirtualdesktop: [],
        }
      );
      setVisibleQueries(filteredQueries);
      return filteredQueries;
    } else {
      return cheatsheetQueries;
    }
  };

  const filterQueriesByCategory = (categories: SelectableValue<string>) => {
    const selectedCategories = categories.map((selectedCategory: SelectableValue) => selectedCategory.label);
    const updatedVisibleQueries = selectedCategories.reduce(
      (updatedVisibleQueries: CheatsheetQueries, queryCategory: string) => {
        updatedVisibleQueries[queryCategory as keyof CheatsheetQueries] =
          cheatsheetQueries![queryCategory as keyof CheatsheetQueries]!;
        return updatedVisibleQueries;
      },
      {}
    );
    setVisibleQueries(updatedVisibleQueries);
  };

  return (
    <div>
      <h3>Azure Monitor cheat sheet</h3>
      <Collapse
        label="Logs"
        collapsible={true}
        isOpen={areDropdownsOpen.Logs}
        onToggle={(isOpen) => setAreDropdownsOpen({ ...areDropdownsOpen, Logs: isOpen })}
      >
        {!isLoading && visibleQueries ? (
          <div>
            <div style={{ display: 'flex' }}>
              <Input
                value={searchInputValue}
                onChange={(e) => {
                  setSearchInputValue(e.currentTarget.value);
                  const filteredQueries = filterQueriesBySearch(e.currentTarget.value);
                  setVisibleQueries(filteredQueries);
                }}
                placeholder="Search Logs queries"
                width={50}
              />
              <InlineField label="Categories" grow={true} labelWidth="auto">
                <Select
                  options={dropdownMenu}
                  value={''}
                  onChange={(a) => filterQueriesByCategory(a)}
                  allowCustomValue={false}
                  backspaceRemovesValue={true}
                  placeholder="All categories"
                  isClearable={true}
                  noOptionsMessage="Unable to list all categories"
                  formatCreateLabel={(input: string) => `Category: ${input}`}
                  isSearchable={true}
                  isMulti={true}
                  width={50}
                />
              </InlineField>
            </div>
            <div style={{ padding: '10px 0 15px 0' }}>
              Query results:{' '}
              {Object.keys(visibleQueries).reduce((totalQueries: number, category) => {
                totalQueries = visibleQueries[category as keyof CheatsheetQueries]!.length + totalQueries;
                return totalQueries;
              }, 0)}
            </div>
            <CustomScrollbar showScrollIndicators={true} autoHeightMax="350px">
              {Object.keys(visibleQueries).map((category: string) => {
                if (visibleQueries[category as keyof CheatsheetQueries]!.length) {
                  return (
                    <Collapse
                      label={category + ' ' + `(${visibleQueries[category as keyof CheatsheetQueries]!.length})`}
                      collapsible={true}
                      isOpen={areDropdownsOpen[category as keyof DropdownCategories]}
                      onToggle={(isOpen) => setAreDropdownsOpen({ ...areDropdownsOpen, [category]: isOpen })}
                      key={category}
                    >
                      {visibleQueries[category as keyof CheatsheetQueries]!.map((query) => {
                        return (
                          <Card className={styles.card} key={query.id}>
                            <Card.Heading>{query.displayName}</Card.Heading>
                            <CustomScrollbar showScrollIndicators={true} autoHeightMax="100px">
                              <RawQuery
                                aria-label={`${query.displayName} raw query`}
                                query={query.body}
                                lang={lang}
                                className={styles.rawQuery}
                              />
                            </CustomScrollbar>
                            <Card.Actions>
                              <Button
                                size="sm"
                                aria-label="use this query button"
                                onClick={() => {
                                  props.onClickExample({
                                    refId: 'A',
                                    queryType: AzureQueryType.LogAnalytics,
                                    azureLogAnalytics: { query: query.body },
                                  });
                                }}
                              >
                                Use this query
                              </Button>
                            </Card.Actions>
                          </Card>
                        );
                      })}
                    </Collapse>
                  );
                }
                return;
              })}
            </CustomScrollbar>
          </div>
        ) : (
          <LoadingPlaceholder text="Loading..." />
        )}
      </Collapse>
    </div>
  );
};

export default AzureCheatSheet;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css`
      width: 49.5%;
      display: flex;
      flex-direction: column;
    `,
    rawQueryContainer: css`
      flex-grow: 1;
    `,
    rawQuery: css`
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
      margin-top: ${theme.spacing(1)};
    `,
    spacing: css`
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};
