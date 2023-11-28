import { cx } from '@emotion/css';
import React, { ComponentProps, FC } from 'react';

import { useStyles, FieldSet as GrafanaFieldSet, CollapsableSection } from '@grafana/ui';

import { getStyles } from './FieldSet.styles';

type CollapsableProps = ComponentProps<typeof CollapsableSection>;
type GrafanaFieldSetProps = ComponentProps<typeof GrafanaFieldSet>;

interface FieldSetProps extends GrafanaFieldSetProps {
  dataTestId?: string;
  collapsableProps?: Omit<CollapsableProps, 'children' | 'label'>;
}

const FieldSet: FC<React.PropsWithChildren<FieldSetProps>> = ({ children, label, collapsableProps, ...props }) => {
  const style = useStyles(getStyles);

  return collapsableProps ? (
    <CollapsableSection
      {...collapsableProps}
      label={label}
      className={cx(style.collapsedSectionWrapper, collapsableProps.className)}
    >
      <GrafanaFieldSet {...props}>{children}</GrafanaFieldSet>
    </CollapsableSection>
  ) : (
    <GrafanaFieldSet className={cx(style.fieldSetWrapper, props.className)} {...props} label={label}>
      {children}
    </GrafanaFieldSet>
  );
};

export default FieldSet;
