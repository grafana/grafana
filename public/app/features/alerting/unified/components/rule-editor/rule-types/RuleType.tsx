import { css } from '@emotion/css';
import { Card, useStyles2 } from '@grafana/ui';
import React, { FC, ReactNode } from 'react';

interface Props {
  image: string;
  name: string;
  description: ReactNode;
  selected?: boolean;
  onClick: () => void;
}

const RuleType: FC<Props> = (props) => {
  const { name, description, image, selected = false, onClick } = props;
  const styles = useStyles2(getStyles);

  return (
    <Card className={styles.wrapper} isSelected={selected} onClick={onClick}>
      <Card.Figure>
        <img src={image} />
      </Card.Figure>
      <Card.Heading>{name}</Card.Heading>
      <Card.Description>{description}</Card.Description>
    </Card>
  );
};

const getStyles = () => ({
  wrapper: css`
    max-width: 360px;
    cursor: pointer;
    user-select: none;
  `,
});

export { RuleType };
