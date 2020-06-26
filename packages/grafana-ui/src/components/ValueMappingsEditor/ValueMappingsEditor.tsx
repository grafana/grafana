import React, { PureComponent } from 'react';
import { MappingType, ValueMapping, GrafanaTheme, ValueMap, RangeMap } from '@grafana/data';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button';
import { ValueMapRow } from './ValueMappingRow';
import { RangeMapRow } from './RangeMappingRow';

export interface Props {
  valueMappings?: ValueMapping[];
  onChange: (valueMappings: ValueMapping[]) => void;
}

interface DraggableMappingProps {
  mapping: ValueMapping;
  index: number;
  onChange: (index: number, mapping: ValueMapping) => void;
  onRemove: (index: number) => void;
}

const DraggableMapping: React.FC<DraggableMappingProps> = ({ mapping, index, onChange, onRemove }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const dragClass = cx('fa fa-ellipsis-v', styles.draggable);

  return (
    <Draggable draggableId={`mapping-${index}`} index={index}>
      {provided => (
        <div
          className="gf-form-inline"
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <div className="gf-form gf-form--grow">
            {mapping.type === MappingType.ValueToText && (
              <ValueMapRow
                dragClass={dragClass}
                mapping={(mapping as unknown) as ValueMap}
                index={index}
                onChange={onChange}
              />
            )}
            {mapping.type === MappingType.RangeToText && (
              <RangeMapRow
                dragClass={dragClass}
                mapping={(mapping as unknown) as RangeMap}
                index={index}
                onChange={onChange}
              />
            )}

            <div className="gf-form-label">
              <Icon name="arrow-right" />
            </div>
            <Input
              width={18}
              defaultValue={mapping.text || ''}
              placeholder={`Display`}
              onBlur={event => {
                onChange(index, { ...mapping, text: event.currentTarget.value });
              }}
            />
            <div className="gf-form-label">
              <IconButton size="sm" name="times" surface="dashboard" onClick={() => onRemove(index)} />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

interface State {
  ts: number;
}

export class ValueMappingsEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      ts: Date.now(),
    };
  }

  componentDidUpdate(props: Props) {
    if (this.props.valueMappings !== props.valueMappings) {
      this.setState({ ts: Date.now() });
    }
  }

  onAddValue = () => {
    const { valueMappings, onChange } = this.props;
    const id = valueMappings && valueMappings.length > 0 ? Math.max(...valueMappings.map(v => v.id)) + 1 : 0;
    onChange([
      ...valueMappings,
      {
        id,
        type: MappingType.ValueToText,
        value: '',
        text: '',
      },
    ]);
  };

  onAddRange = () => {
    const { valueMappings, onChange } = this.props;
    const id = valueMappings && valueMappings.length > 0 ? Math.max(...valueMappings.map(v => v.id)) + 1 : 0;
    onChange([
      ...valueMappings,
      {
        id,
        type: MappingType.RangeToText,
        from: '',
        to: '',
        text: '',
      },
    ]);
  };

  onDragEnd = (result: DropResult) => {
    const { valueMappings } = this.props;
    if (!valueMappings || !result.destination) {
      return;
    }
    const fromIndex = result.source.index;
    const toIndex = result.destination.index;

    const copy = [...valueMappings];
    const element = copy[fromIndex];
    copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, element);
    copy.forEach((v, idx) => {
      v.id = idx; // update the ids
    });
    this.props.onChange(copy);
  };

  onChange = (index: number, mapping: ValueMapping) => {
    const values = [...this.props.valueMappings];
    values[index] = mapping;
    this.props.onChange(values);
  };

  onRemove = (index: number) => {
    const values = [...this.props.valueMappings];
    values.splice(index, 1);
    this.props.onChange(values);
  };

  render() {
    const { valueMappings } = this.props;
    const { ts } = this.state;

    return (
      <div>
        {valueMappings && (
          <DragDropContext onDragEnd={this.onDragEnd}>
            <Droppable droppableId="sortable-field-mappings" direction="vertical">
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {valueMappings.map((mapping, index) => {
                    return (
                      <DraggableMapping
                        mapping={mapping}
                        index={index}
                        onChange={this.onChange}
                        onRemove={this.onRemove}
                        key={`${index}/${ts}`}
                      />
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
        <br />
        <Button
          size="sm"
          icon="plus"
          onClick={this.onAddValue}
          aria-label="ValueMappingsEditor add value button"
          variant="secondary"
        >
          Add value mapping
        </Button>
        &nbsp;
        <Button
          size="sm"
          icon="plus"
          onClick={this.onAddRange}
          aria-label="ValueMappingsEditor add range button"
          variant="secondary"
        >
          Add range mapping
        </Button>
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  draggable: css`
    padding: 0;
    font-size: ${theme.typography.size.md};
    opacity: 0.4;
    &:hover {
      color: ${theme.colors.textStrong};
    }
  `,
}));
