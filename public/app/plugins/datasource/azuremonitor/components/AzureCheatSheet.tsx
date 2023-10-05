import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getBackendSrv, reportInteraction } from '@grafana/runtime';
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
  [key: string]: CheatsheetQuery[];
};

type DropdownCategories = {
  [key: string]: boolean;
};

type Props = {
  onClickExample: (query: AzureMonitorQuery) => void;
  query: AzureMonitorQuery;
};

const AzureCheatSheet = (props: Props) => {
  const [cheatsheetQueries, setCheatsheetQueries] = useState<CheatsheetQueries | null>(null);
  const [areDropdownsOpen, setAreDropdownsOpen] = useState<DropdownCategories>({});
  const [visibleQueries, setVisibleQueries] = useState<CheatsheetQueries | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInputValue, setSearchInputValue] = useState('');
  const styles = useStyles2(getStyles);
  const lang = { grammar: tokenizer, name: 'kql' };
  const dropdownMenu = useMemo(() => {
    if (cheatsheetQueries) {
      return Object.keys(cheatsheetQueries).map((category): SelectableValue<string> => {
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
        const alphabetizedQueries = result.categories.reduce(
          (queriesByCategory: CheatsheetQueries, category: Category) => {
            const categoryQueries = category.related.queries.map((queryId: string) => {
              return result.queries.find((query: CheatsheetQuery) => query.id === queryId);
            });
            queriesByCategory[category.displayName] = categoryQueries;
            setAreDropdownsOpen({ ...areDropdownsOpen, [category.id]: false });
            return queriesByCategory;
          },
          {}
        );
        setCheatsheetQueries(alphabetizedQueries);
        setVisibleQueries(alphabetizedQueries);
        setIsLoading(false);
        return alphabetizedQueries;
      });
  };

  useEffect(() => {
    if (!cheatsheetQueries) {
      getCheatsheetQueries();
    }
  });

  const filterQueriesBySearch = (searchValue: string) => {
    const visibleQueriesCategories = Object.keys(visibleQueries!);
    if (searchValue.length > 0 && cheatsheetQueries) {
      const filteredQueries: CheatsheetQueries = Object.keys(cheatsheetQueries).reduce(
        (filteredQueriesBySearch: CheatsheetQueries, category) => {
          const filters = cheatsheetQueries![category]!.filter((query) => {
            return query.displayName.toLowerCase().includes(searchValue.toLowerCase());
          });
          if (visibleQueriesCategories.includes(category)) {
            filteredQueriesBySearch[category] = filters;
          }
          return filteredQueriesBySearch;
        },
        {}
      );

      setVisibleQueries(filteredQueries);
      return filteredQueries;
    } else {
      if (Object.keys(visibleQueries!).length !== Object.keys(cheatsheetQueries!).length) {
        setVisibleQueries(visibleQueries);
        return visibleQueries;
      } else {
        setVisibleQueries(cheatsheetQueries);
        return cheatsheetQueries;
      }
    }
  };

  const filterQueriesByCategory = (categories: SelectableValue<string>) => {
    if (categories.length > 0) {
      const selectedCategories = categories.map((selectedCategory: SelectableValue) => selectedCategory.label);
      const updatedVisibleQueries = selectedCategories.reduce(
        (updatedVisibleQueries: CheatsheetQueries, queryCategory: string) => {
          updatedVisibleQueries[queryCategory] = cheatsheetQueries![queryCategory]!;
          return updatedVisibleQueries;
        },
        {}
      );
      setVisibleQueries(updatedVisibleQueries);
    } else {
      setVisibleQueries(cheatsheetQueries);
    }
  };

  return (
    <div>
      <h3>Azure Monitor Cheat Sheet</h3>
      <Collapse
        label="Logs"
        collapsible={true}
        isOpen={areDropdownsOpen.Logs}
        onToggle={(isOpen) => setAreDropdownsOpen({ ...areDropdownsOpen, Logs: isOpen })}
      >
        {!isLoading && visibleQueries ? (
          <div>
            <div className={css({ display: 'flex' })}>
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
            <div>
              Query results:{' '}
              {Object.keys(visibleQueries).reduce((totalQueries: number, category) => {
                totalQueries = visibleQueries[category]!.length + totalQueries;
                return totalQueries;
              }, 0)}
            </div>
            <CustomScrollbar showScrollIndicators={true} autoHeightMax="350px">
              {Object.keys(visibleQueries).map((category: string) => {
                if (visibleQueries[category]!.length) {
                  return (
                    <Collapse
                      label={category + ' ' + `(${visibleQueries[category]!.length})`}
                      collapsible={true}
                      isOpen={areDropdownsOpen[category]}
                      onToggle={(isOpen) => setAreDropdownsOpen({ ...areDropdownsOpen, [category]: isOpen })}
                      key={category}
                    >
                      {visibleQueries[category]!.map((query) => {
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
                                  reportInteraction('grafana_azure_cheatsheet_logs_query_selected', {
                                    id: query.id,
                                    queryName: query.displayName,
                                    query: query.body,
                                    queryCategories: query.related.categories,
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
    card: css({
      width: '49.5%',
      display: 'flex',
      flexDirection: 'column',
    }),
    rawQuery: css({
      backgroundColor: `${theme.colors.background.primary}`,
      padding: `${theme.spacing(1)}`,
      marginTop: `${theme.spacing(1)}`,
    }),
    spacing: css({
      marginBottom: `${theme.spacing(1)}`,
    }),
  };
};
