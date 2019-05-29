// Libraries
import React, { FC, useContext } from 'react';

// Components
import { css } from 'emotion';
import { PanelDrillDownLink, ThemeContext } from '../../index';
import { Button, ButtonVariant } from '../index';
import { DrilldownLinkEditor } from './DrilldownLinkEditor';

export interface Props {
  value: PanelDrillDownLink[];
  onChange: (links: PanelDrillDownLink[]) => void;
}

export const DrilldownLinksEditor: FC<Props> = React.memo(({ value, onChange }) => {
  const theme = useContext(ThemeContext);

  const onAdd = () => {
    onChange([...value, { url: '', title: '' }]);
  };

  const onLinkChanged = (linkIndex: number, newLink: PanelDrillDownLink) => {
    onChange(
      value.map((item, listIndex) => {
        if (linkIndex === listIndex) {
          return newLink;
        }
        return item;
      })
    );
  };

  const onRemove = (link: PanelDrillDownLink) => {
    onChange(value.filter(item => item !== link));
  };

  return (
    <>
      {value && value.length > 0 && (
        <div
          className={css`
            margin-bottom: ${theme.spacing.sm};
          `}
        >
          {value.map((link, index) => (
            <DrilldownLinkEditor
              key={index.toString()}
              index={index}
              value={link}
              onChange={onLinkChanged}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      <Button variant={ButtonVariant.Inverse} icon="fa fa-plus" onClick={() => onAdd()}>
        Create link
      </Button>
    </>
  );
});

DrilldownLinksEditor.displayName = 'DrilldownLinksEditor';
