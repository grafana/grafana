import React, { PureComponent, CSSProperties } from 'react';
import { VizOrientation } from '../../types';

interface Props<T> {
  renderValue: (value: T, width: number, height: number) => JSX.Element;
  height: number;
  width: number;
  source: any; // If this changes, new values will be requested
  getValues: () => T[];
  renderCounter: number; // force update of values & render
  orientation: VizOrientation;
  itemSpacing?: number;
}

interface DefaultProps {
  itemSpacing: number;
}

type PropsWithDefaults<T> = Props<T> & DefaultProps;

interface State<T> {
  values: T[];
}

export class VizRepeater<T> extends PureComponent<Props<T>, State<T>> {
  static defaultProps: DefaultProps = {
    itemSpacing: 10,
  };

  constructor(props: Props<T>) {
    super(props);

    this.state = {
      values: props.getValues(),
    };
  }

  componentDidUpdate(prevProps: Props<T>) {
    const { renderCounter, source } = this.props;
    if (renderCounter !== prevProps.renderCounter || source !== prevProps.source) {
      this.setState({ values: this.props.getValues() });
    }
  }

  getOrientation(): VizOrientation {
    const { orientation, width, height } = this.props;

    if (orientation === VizOrientation.Auto) {
      if (width > height) {
        return VizOrientation.Vertical;
      } else {
        return VizOrientation.Horizontal;
      }
    }

    return orientation;
  }

  render() {
    const { renderValue, height, width, itemSpacing } = this.props as PropsWithDefaults<T>;
    const { values } = this.state;
    const orientation = this.getOrientation();

    const itemStyles: React.CSSProperties = {
      display: 'flex',
    };

    const repeaterStyle: React.CSSProperties = {
      display: 'flex',
    };

    let vizHeight = height;
    let vizWidth = width;

    if (orientation === VizOrientation.Horizontal) {
      repeaterStyle.flexDirection = 'column';
      itemStyles.marginBottom = `${itemSpacing}px`;
      vizWidth = width;
      vizHeight = height / values.length - itemSpacing + itemSpacing / values.length;
    } else {
      repeaterStyle.flexDirection = 'row';
      repeaterStyle.justifyContent = 'space-between';
      itemStyles.marginRight = `${itemSpacing}px`;
      vizHeight = height;
      vizWidth = width / values.length - itemSpacing + itemSpacing / values.length;
    }

    itemStyles.width = `${vizWidth}px`;
    itemStyles.height = `${vizHeight}px`;

    return (
      <div style={repeaterStyle}>
        {values.map((value, index) => {
          return (
            <div key={index} style={getItemStylesForIndex(itemStyles, index, values.length)}>
              {renderValue(value, vizWidth, vizHeight)}
            </div>
          );
        })}
      </div>
    );
  }
}

/*
 * Removes any padding on the last item
 */
function getItemStylesForIndex(itemStyles: CSSProperties, index: number, length: number): CSSProperties {
  if (index === length - 1) {
    return {
      ...itemStyles,
      marginRight: 0,
      marginBottom: 0,
    };
  }
  return itemStyles;
}
