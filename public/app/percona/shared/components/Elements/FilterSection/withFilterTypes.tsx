/* eslint-disable react/display-name */
import { cx } from '@emotion/css';
import { LoaderButton } from '@percona/platform-core';
import React, { FC, useState, useCallback } from 'react';
import { withTypes } from 'react-final-form';

import { Collapse, HorizontalGroup, useStyles2 } from '@grafana/ui';

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
            <form onSubmit={handleSubmit} className={cx(styles.form, className)} role="form">
              {children}
              <HorizontalGroup justify="flex-end" spacing="md">
                <LoaderButton
                  data-testid="apply-filters-button"
                  size="md"
                  variant="primary"
                  disabled={!valid || pristine}
                  loading={submitting}
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
