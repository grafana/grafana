import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Stack, Text, useStyles2 } from '@grafana/ui';

import { DataSourceConfigValidationAPI } from '../../../../../../../../packages/grafana-data/src/types/datasource';

import { DatabaseConnectionSection } from './DatabaseConnectionSection';
import { LeftSideBar } from './LeftSideBar';
import { UrlAndAuthenticationSection } from './UrlAndAuthenticationSection';
import { CONTAINER_MIN_WIDTH } from './constants';
import { Props } from './types';

const createValidationAPI = (): DataSourceConfigValidationAPI => {
  const validators = new Set<() => Promise<boolean> | boolean>();
  const errors: Record<string, string> = {};

  return {
    registerValidation(validator) {
      validators.add(validator);
      return () => validators.delete(validator);
    },

    async validate() {
      const results = await Promise.all(Array.from(validators).map((v) => Promise.resolve(v())));
      return results.every(Boolean);
    },

    isValid() {
      return Object.keys(errors).length === 0;
    },

    getErrors() {
      return errors;
    },

    setError(field, message) {
      errors[field] = message;
    },

    clearError(field) {
      delete errors[field];
    },
  };
};

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options, validation }: Props) => {
  const styles = useStyles2(getStyles);

  const validationAPI = useMemo(() => validation || createValidationAPI(), [validation]);

  return (
    <Stack justifyContent="space-between">
      <div className={`${styles.hideOnSmallScreen} ${styles.leftSticky}`}>
        <Box width="100%" flex="1 1 auto">
          <LeftSideBar pdcInjected={options?.jsonData?.pdcInjected!!} />
        </Box>
      </div>
      <Box width="60%" flex="1 1 auto" minWidth={CONTAINER_MIN_WIDTH}>
        <Stack direction="column">
          <Text variant="bodySmall" color="secondary">
            Fields marked with * are required
          </Text>
          <UrlAndAuthenticationSection options={options} onOptionsChange={onOptionsChange} validation={validationAPI} />
          <DatabaseConnectionSection options={options} onOptionsChange={onOptionsChange} />
        </Stack>
      </Box>
      <Box width="20%" flex="0 0 20%">
        {/* TODO: Right sidebar */}
      </Box>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    hideOnSmallScreen: css({
      width: '250px',
      flex: '0 0 250px',
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    }),
    leftSticky: css({
      position: 'sticky',
      top: '100px',
      alignSelf: 'flex-start',
      maxHeight: 'calc(100vh - 100px)',
      overflow: 'hidden',
    }),
    alertHeight: css({
      height: '100px',
    }),
  };
};
