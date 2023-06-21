import { css } from '@emotion/css';
import React, { ChangeEvent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Icon, InlineField, InlineLabel, TextArea, useStyles2 } from '@grafana/ui';
import { HoverCard } from 'app/features/alerting/unified/components/HoverCard';

import { ExpressionQuery } from '../types';

interface Props {
  labelWidth: number | 'auto';
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
  onRunQuery: () => void;
}

const mathPlaceholder =
  'Math operations on one or more queries. You reference the query by ${refId} ie. $A, $B, $C etc\n' +
  'The sum of two scalar values: $A + $B > 10';

export const Math = ({ labelWidth, onChange, query, onRunQuery }: Props) => {
  const onExpressionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...query, expression: event.target.value });
  };

  const styles = useStyles2(getStyles);

  const executeQuery = () => {
    if (query.expression) {
      onRunQuery();
    }
  };

  return (
    <Stack direction="row">
      <InlineField
        label={
          <InlineLabel width="auto">
            <HoverCard
              content={
                <div className={styles.documentationContainer}>
                  <header className={styles.documentationHeader}>
                    <Icon name="book-open" /> Math operator
                  </header>
                  <div>
                    Run math operations on one or more queries. You reference the query by {'${refId}'} ie. $A, $B, $C
                    etc.
                    <br />
                    Example: <code>$A + $B</code>
                  </div>
                  <header className={styles.documentationHeader}>Available Math functions</header>
                  <div className={styles.documentationFunctions}>
                    <DocumentedFunction
                      name="abs"
                      description="returns the absolute value of its argument which can be a number or a series"
                    />
                    <DocumentedFunction
                      name="is_inf"
                      description="returns 1 for Inf values (negative or positive) and 0 for other values. It's able to operate on series or scalar values."
                    />
                    <DocumentedFunction
                      name="is_nan"
                      description="returns 1 for NaN values and 0 for other values. It's able to operate on series or scalar values."
                    />
                    <DocumentedFunction
                      name="is_null"
                      description="returns 1 for null values and 0 for other values. It's able to operate on series or scalar values."
                    />
                    <DocumentedFunction
                      name="is_number"
                      description="returns 1 for all real number values and 0 for non-number. It's able to operate on series or scalar values."
                    />
                    <DocumentedFunction
                      name="log"
                      description="returns the natural logarithm of its argument, which can be a number or a series"
                    />
                    <DocumentedFunction
                      name="inf, infn, nan, and null"
                      description="The inf for infinity positive, infn for infinity negative, nan, and null functions all return a single scalar value that matches its name."
                    />
                    <DocumentedFunction
                      name="round"
                      description="returns a rounded integer value. It's able to operate on series or escalar values."
                    />
                    <DocumentedFunction
                      name="ceil"
                      description="rounds the number up to the nearest integer value. It's able to operate on series or escalar values."
                    />
                    <DocumentedFunction
                      name="floor"
                      description="rounds the number down to the nearest integer value. It's able to operate on series or escalar values."
                    />
                  </div>
                  <div>
                    See our additional documentation on{' '}
                    <a
                      className={styles.documentationLink}
                      target="_blank"
                      href="https://grafana.com/docs/grafana/latest/panels/query-a-data-source/use-expressions-to-manipulate-data/about-expressions/#math"
                      rel="noreferrer"
                    >
                      <Icon size="xs" name="external-link-alt" /> Math expressions
                    </a>
                    .
                  </div>
                </div>
              }
            >
              <span>
                Expression <Icon name="info-circle" />
              </span>
            </HoverCard>
          </InlineLabel>
        }
        labelWidth={labelWidth}
        grow={true}
        shrink={true}
      >
        <TextArea
          value={query.expression}
          onChange={onExpressionChange}
          rows={1}
          placeholder={mathPlaceholder}
          onBlur={executeQuery}
          style={{ minWidth: 250, lineHeight: '26px', minHeight: 32 }}
        />
      </InlineField>
    </Stack>
  );
};

interface DocumentedFunctionProps {
  name: string;
  description: React.ReactNode;
}
const DocumentedFunction = ({ name, description }: DocumentedFunctionProps) => {
  const styles = useStyles2(getDocumentedFunctionStyles);

  return (
    <>
      <span className={styles.name}>{name}</span>
      <span className={styles.description}>{description}</span>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  documentationHeader: css`
    font-size: ${theme.typography.h5.fontSize};
    font-weight: ${theme.typography.h5.fontWeight};
  `,
  documentationLink: css`
    color: ${theme.colors.text.link};
  `,
  documentationContainer: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: ${theme.spacing(2)};

    padding: ${theme.spacing(1)} ${theme.spacing(2)};
  `,
  documentationFunctions: css`
    display: grid;
    grid-template-columns: max-content auto;
    column-gap: ${theme.spacing(2)};
  `,
});

const getDocumentedFunctionStyles = (theme: GrafanaTheme2) => ({
  name: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
  description: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.disabled};
  `,
});
