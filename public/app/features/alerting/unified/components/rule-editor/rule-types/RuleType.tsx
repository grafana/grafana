import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
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
  const styles = useStyles2((theme) => getStyles(theme, selected));

  return (
    <Card className={cx(styles.wrapper, styles.selected)} onClick={onClick}>
      <Card.Figure>
        <img src={image} />
      </Card.Figure>
      <Card.Heading className={styles.heading}>
        <div className={styles.headWrapper}>
          <div className={styles.name}>{name}</div>
          <div className={styles.radioButton}>
            <input type="radio" checked={selected} />
          </div>
        </div>
      </Card.Heading>
      <Card.Description>{description}</Card.Description>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2, selected: boolean) => ({
  wrapper: css`
    max-width: 360px;
    cursor: pointer;
    user-select: none;
  `,
  selected:
    selected &&
    css`
      outline: ${theme.v1.colors.bgBlue1} solid 2px;
    `,
  radioButton: css`
    align-self: flex-end;
  `,
  headWrapper: css`
    flex: 1;
    display: flex;
    flex-direction: row;
  `,
  heading: css`
    > button {
      width: 100%;
    }
  `,
  name: css`
    flex: 1;
  `,
});

export { RuleType };
