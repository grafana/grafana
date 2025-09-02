import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import {
  Button,
  Card,
  Collapse,
  Field,
  Input,
  LoadingPlaceholder,
  ScrollContainer,
  Select,
  useStyles2,
} from '@grafana/ui';

import AzureLogAnalyticsDatasource from '../../azure_log_analytics/azure_log_analytics_datasource';
import { AzureMonitorQuery, AzureQueryType } from '../../types/query';
import { Category, CheatsheetQueries, CheatsheetQuery, DropdownCategories } from '../../types/types';

import { RawQuery } from './RawQuery';
import tokenizer from './syntax';

export interface AzureCheatSheetProps {
  onChange: (query: AzureMonitorQuery) => void;
  query: AzureMonitorQuery;
  datasource: AzureLogAnalyticsDatasource;
}

const AzureCheatSheet = (props: AzureCheatSheetProps) => {
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
    await props.datasource.getAzureLogAnalyticsCheatsheetQueries().then((result) => {
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
      {!isLoading && visibleQueries ? (
        <div>
          <div className={styles.filterAlignment}>
            <Input
              value={searchInputValue}
              onChange={(e) => {
                setSearchInputValue(e.currentTarget.value);
                const filteredQueries = filterQueriesBySearch(e.currentTarget.value);
                setVisibleQueries(filteredQueries);
              }}
              placeholder={t('components.azure-cheat-sheet.placeholder-search-logs', 'Search Logs queries')}
              width={40}
            />
            <Field
              label={t('components.azure-cheat-sheet.label-categories', 'Categories')}
              className={styles.categoryDropdown}
            >
              <Select
                options={dropdownMenu}
                value={''}
                onChange={(a) => filterQueriesByCategory(a)}
                allowCustomValue={false}
                backspaceRemovesValue={true}
                placeholder={t('components.azure-cheat-sheet.placeholder-all-categories', 'All categories')}
                isClearable={true}
                noOptionsMessage={t(
                  'components.azure-cheat-sheet.noOptionsMessage-unable-to-list-categories',
                  'Unable to list all categories'
                )}
                formatCreateLabel={(input: string) => `Category: ${input}`}
                isSearchable={true}
                isMulti={true}
                width={40}
              />
            </Field>
          </div>
          <div className={styles.spacing}>
            <Trans
              i18nKey="components.azure-cheat-sheet.label-query-results"
              values={{
                numResults: Object.keys(visibleQueries).reduce((totalQueries: number, category) => {
                  totalQueries = visibleQueries[category]!.length + totalQueries;
                  return totalQueries;
                }, 0),
              }}
            >
              Query results: {'{{numResults}}'}
            </Trans>
          </div>
          <ScrollContainer showScrollIndicators maxHeight="350px">
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
                        <Card noMargin className={styles.card} key={query.id}>
                          <Card.Heading>{query.displayName}</Card.Heading>
                          <ScrollContainer showScrollIndicators maxHeight="100px">
                            <RawQuery
                              aria-label={t(
                                'components.azure-cheat-sheet.aria-label-raw-query',
                                '{{queryDisplayName}} raw query',
                                { queryDisplayName: query.displayName }
                              )}
                              query={query.body}
                              lang={lang}
                              className={styles.rawQuery}
                            />
                          </ScrollContainer>
                          <Card.Actions>
                            <Button
                              size="sm"
                              aria-label={t(
                                'components.azure-cheat-sheet.aria-label-use-query',
                                'Use this query button'
                              )}
                              onClick={() => {
                                props.onChange({
                                  refId: 'A',
                                  queryType: AzureQueryType.LogAnalytics,
                                  azureLogAnalytics: { query: query.body },
                                  datasource: props.datasource,
                                });
                                reportInteraction('grafana_azure_cheatsheet_logs_query_selected', {
                                  id: query.id,
                                  queryName: query.displayName,
                                  query: query.body,
                                  queryCategories: query.related.categories,
                                });
                              }}
                            >
                              <Trans i18nKey="components.azure-cheat-sheet.button-use-query">Use this query</Trans>
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
          </ScrollContainer>
        </div>
      ) : (
        <LoadingPlaceholder text={t('components.azure-cheat-sheet.text-loading', 'Loading...')} />
      )}
    </div>
  );
};

export default AzureCheatSheet;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      width: '90%',
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
    filterAlignment: css({
      display: 'flex',
    }),
    categoryDropdown: css({
      margin: '0 0 10px 10px',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    }),
  };
};
