import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Card, Collapse, useStyles2 } from '@grafana/ui';

import tokenizer from '../../cloudwatch/language/cloudwatch-logs/syntax';
import { RawQuery } from '../../prometheus/querybuilder/shared/RawQuery';
import { AzureMonitorQuery, AzureQueryType } from '../types';

type CategoriesCheatsheet = {
  id: string;
  displayName: string;
  related: {
    tables: string[];
    queries: string[];
  };
};

type FunctionsCheatsheet = {
  id: string;
  body: string;
  description: string;
  parameters: string;
  name: string;
  related: {
    resourceTypes: string[];
    solutions: string[];
  };
};

type QueriesCheatsheet = {
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

type ResourceTypesCheatsheet = {
  description: string;
  displayName: string;
  id: string;
  related: {
    tables: string[];
    queries: string[];
  };
  type: string;
};

type SolutionsCheatsheet = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  related: {
    tables: string[];
    queries: string[];
  };
};

type TablesCheatsheetColumns = {
  name: string;
  type: string;
  description?: string;
};

type TablesCheatsheet = {
  id: string;
  name: string;
  tableAPIState: string;
  tableType: string;
  timespanColumn: string;
  related: {
    categories: string[];
    resourceTypes: string[];
    solutions: string[];
    queries: string[];
  };
  columns: TablesCheatsheetColumns[];
};

type Cheatsheet = {
  categories: CategoriesCheatsheet[];
  functions: FunctionsCheatsheet[];
  queries: QueriesCheatsheet[];
  resourceTypes: ResourceTypesCheatsheet[];
  solutions: SolutionsCheatsheet[];
  tables: TablesCheatsheet[];
};

type Props = {
  onClickExample: (query: AzureMonitorQuery) => void;
  query: AzureMonitorQuery;
};

const AzureCheatSheet = (props: Props) => {
  const [cheatsheetQueries, setCheatsheetQueries] = useState<Cheatsheet | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const styles = useStyles2(getStyles);
  const lang = { grammar: tokenizer, name: 'kql' };

  const getCheatsheetQueries = async () => {
    await getBackendSrv()
      .get(`https://api.loganalytics.io/v1/metadata`)
      .then((result) => {
        console.log('result', result);
        setCheatsheetQueries(result);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (!cheatsheetQueries) {
      getCheatsheetQueries();
    }
  });

  return (
    <div>
      <h3>Azure Monitor cheat sheet</h3>
      <Collapse label="Logs" collapsible={true} isOpen={isLogsOpen} onToggle={(isOpen) => setIsLogsOpen(isOpen)}>
        {!isLoading && cheatsheetQueries ?
          cheatsheetQueries.queries.map((query) => {
            return (
              <Card className={styles.card} key={query.id}>
                <Card.Heading>{query.displayName}</Card.Heading>
                <div className={styles.rawQueryContainer}>
                  <RawQuery
                    aria-label={`${query.displayName} raw query`}
                    query={query.body}
                    lang={lang}
                    className={styles.rawQuery}
                  />
                </div>
                <Card.Actions>
                  <Button size="sm" aria-label="use this query button" onClick={() => props.onClickExample({refId: "A", queryType: AzureQueryType.LogAnalytics})}>
                    Use this query
                  </Button>
                </Card.Actions>
              </Card>
            );
          }) : "Loading..."}
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
