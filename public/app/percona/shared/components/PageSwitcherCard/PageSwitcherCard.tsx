import { cx } from '@emotion/css';
import React, { useState } from 'react';
import { Field } from 'react-final-form';

import { Card, useStyles2 } from '@grafana/ui';

import { getStyles } from './PageSwitcherCard.styles';
import { PageSwitcherProps, SelectedState } from './PageSwitcherCard.types';

export const PageSwitcherCard = <T extends {}>({ values, className }: PageSwitcherProps<T>) => {
  const styles = useStyles2(getStyles);
  const [selectedStates, setSelectedStates] = useState<SelectedState[]>(
    values.map((v) => ({ id: v.id, selected: v.selected }))
  );
  const cardStyles = cx({
    [styles.wrapper]: true,
    [styles.disabled]: false,
  });

  return (
    <div className={cx(styles.pageSwitcherWrapper, className)}>
      {values.map((item) => (
        <Field name={`${item.name}`} component="input" type="radio" key={`field-${item.id}`} value={item.value}>
          {({ input }) => (
            <Card
              className={cardStyles}
              isSelected={selectedStates.find((v) => v.id === item.id)?.selected}
              onClick={(e) => {
                e.preventDefault();
                setSelectedStates((states) => states.map((v) => ({ id: v.id, selected: v.id === item.id })));
                input.onChange({ target: { value: input.value } });
                item.onClick && item.onClick();
              }}
              data-testid={`field-${item.id}`}
            >
              <Card.Heading>{item.label}</Card.Heading>
              <Card.Description>{item.description}</Card.Description>
            </Card>
          )}
        </Field>
      ))}
    </div>
  );
};
