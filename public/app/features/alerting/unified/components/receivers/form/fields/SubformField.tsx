import React, { FC } from 'react';
import { NotificationChannelOption } from 'app/types';
import { FieldError, NestDataObject } from 'react-hook-form';
import { OptionField } from './OptionField';
import { GrafanaThemeV2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { CollapsibleSection } from '../CollapsibleSection';

interface Props {
  option: NotificationChannelOption;
  pathPrefix: string;
  error?: FieldError | NestDataObject<any, FieldError>;
}

export const SubformField: FC<Props> = ({ option, pathPrefix = '', error }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <CollapsibleSection className={styles.collapsibleSection} label={option.label} description={option.description}>
        {(option.subformOptions ?? []).map((subOption) => {
          return (
            <OptionField
              key={subOption.propertyName}
              option={subOption}
              pathPrefix={`${pathPrefix}${option.propertyName}.`}
              error={(error as NestDataObject<any, FieldError>)?.[subOption.propertyName]}
            />
          );
        })}
      </CollapsibleSection>
    </div>
  );
};

const getStyles = (theme: GrafanaThemeV2) => ({
  collapsibleSection: css`
    margin: 0;
    padding: 0;
  `,
  wrapper: css`
    margin: ${theme.spacing(2, 0)};
    padding: ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.medium};
    border-radius: ${theme.shape.borderRadius(1)};
  `,
});
