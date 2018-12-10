import React from 'react';
import classNames from 'classnames';
import { PanelPlugin } from 'app/types/plugins';

interface Props {
  isSelected: boolean;
  isCurrent: boolean;
  plugin: PanelPlugin;
  onClick: () => void;
  onMouseEnter: () => void;
}

const VizTypePickerPlugin = React.memo(
  ({ isSelected, isCurrent, plugin, onClick, onMouseEnter }: Props) => {
    const cssClass = classNames({
      'viz-picker__item': true,
      'viz-picker__item--selected': isSelected,
      'viz-picker__item--current': isCurrent,
    });

    return (
      <div className={cssClass} onClick={onClick} title={plugin.name} onMouseEnter={onMouseEnter}>
        <div className="viz-picker__item-name">{plugin.name}</div>
        <img className="viz-picker__item-img" src={plugin.info.logos.small} />
      </div>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.isSelected === nextProps.isSelected && prevProps.isCurrent === nextProps.isCurrent) {
      return true;
    }
    return false;
  }
);

export default VizTypePickerPlugin;
