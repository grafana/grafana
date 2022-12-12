import { css, cx } from '@emotion/css';
import React, { FC, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, useStyles2 } from '@grafana/ui';

import { RuleFormType } from '../../../types/rule-form';

interface Props extends SharedProps {
  image: string;
  name: string;
  description: ReactNode;
  value: RuleFormType;
}

// these properties are shared between all Rule Types
export interface SharedProps {
  selected?: boolean;
  disabled?: boolean;
  onClick: (value: RuleFormType) => void;
}

const RuleType: FC<Props> = (props) => {
  const { name, description, image, selected = false, value, onClick, disabled = false } = props;
  const styles = useStyles2(getStyles);

  const cardStyles = cx({
    [styles.wrapper]: true,
    [styles.disabled]: disabled,
  });

  return (
    <Card className={cardStyles} isSelected={selected} onClick={() => onClick(value)} disabled={disabled}>
      <Card.Figure>
        <img src={image} alt="" />
      </Card.Figure>
      <Card.Heading>{name}</Card.Heading>
      <Card.Description>{description}</Card.Description>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    width: 380px;
    cursor: pointer;
    user-select: none;
  `,
  disabled: css`
    opacity: 0.5;
  `,
});

export { RuleType };
