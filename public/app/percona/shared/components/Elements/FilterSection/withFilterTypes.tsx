/* eslint-disable jsx-a11y/no-redundant-roles */
/* eslint-disable react/display-name */
import { cx } from '@emotion/css';
import React, { FC, useCallback, useState } from 'react';
import { withTypes } from 'react-final-form';

import { Collapse, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';

import { getStyles } from './FilterSection.styles';
import { FilterSectionProps } from './FilterSection.types';

export const withFilterTypes =
  <T extends object>(initialValues?: Partial<T>): FC<FilterSectionProps<T>> =>
  ({ children, onApply, isOpen, className = '' }) => {
    const styles = useStyles2(getStyles);
    const [sectionIsOpen, setSectionIsOpen] = useState(!!isOpen);
    const { Form } = withTypes<T>();

    const changeIsOpen = useCallback(() => setSectionIsOpen((open) => !open), []);

    return (
      <Form
        initialValues={initialValues}
        onSubmit={onApply}
        render={({ form, handleSubmit, submitting, valid, pristine }) => (
          <Collapse
            collapsible
            isOpen={sectionIsOpen}
            onToggle={changeIsOpen}
            className={styles.collapse}
            label="Filters"
          >
            <form role="form" onSubmit={handleSubmit} className={cx(styles.form, className)}>
              {children}
              <HorizontalGroup justify="flex-end" spacing="md">
                <LoaderButton
                  data-testid="apply-filters-button"
                  size="md"
                  variant="primary"
                  disabled={!valid || pristine}
                  loading={submitting}
                  type="submit"
                >
                  Apply
                </LoaderButton>
              </HorizontalGroup>
            </form>
          </Collapse>
        )}
      />
    );
  };
