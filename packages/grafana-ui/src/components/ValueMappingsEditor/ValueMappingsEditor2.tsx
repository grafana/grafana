import React, { PureComponent } from 'react';
import { MappingType, ValueMapping, GrafanaTheme, ValueMap, RangeMap } from '@grafana/data';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Icon } from '../Icon/Icon';

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

interface ValueMapProps {
  dragClass: string;
  mapping: ValueMap;
  index: number;
  onChange: (index: number, mapping: ValueMapping) => void;
}

class ValueMapRow extends PureComponent<ValueMapProps> {
  constructor(props: ValueMapProps) {
    super(props);
  }

  render() {
    const { mapping, dragClass } = this.props;

    return (
      <>
        <div className="gf-form-label width-4">
          <i className={dragClass} />
          VALUE
        </div>

        <Input
          width={21}
          defaultValue={mapping.value || ''}
          placeholder={`Value`}
          onBlur={event => {
            console.log('Value', event);
          }}
        />
      </>
    );
  }
}

interface RangeMapProps {
  dragClass: string;
  mapping: RangeMap;
  index: number;
  onChange: (index: number, mapping: ValueMapping) => void;
}

class RangeMapRow extends PureComponent<RangeMapProps> {
  constructor(props: RangeMapProps) {
    super(props);
  }

  render() {
    const { dragClass, mapping } = this.props;
    return (
      <>
        <div className="gf-form-label width-4">
          <i className={dragClass} />
          RANGE
        </div>
        <Input
          width={9}
          type="number"
          defaultValue={mapping.from || ''}
          placeholder={`From`}
          onBlur={event => {
            console.log('FROM', event);
          }}
        />
        <div className="gf-form-label">TO</div>
        <Input
          width={9}
          type="number"
          defaultValue={mapping.to || ''}
          placeholder={`To`}
          onBlur={event => {
            console.log('TO', event);
          }}
        />
      </>
    );
  }
}

const DraggableMapping: React.FC<DraggableMappingProps> = ({ mapping, index, onChange, onRemove }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const dragClass = cx('fa fa-ellipsis-v', styles.draggable);

  return (
    <Draggable draggableId={`map-${index}`} index={index}>
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
              placeholder={`Text...`}
              onBlur={event => {
                console.log('TEXT', event);
              }}
            />
            <div className="gf-form-label">
              <IconButton
                className={styles.toggle}
                size="sm"
                name="times"
                surface="dashboard"
                onClick={() => onRemove(index)}
              />
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export class ValueMappingsEditor2 extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  onDragEnd = (result: DropResult) => {
    console.log('DRAG!!!', result);
  };

  onChange = (index: number, mapping: ValueMapping) => {
    console.log('CHANGE', index, mapping);
  };

  onRemove = (index: number) => {
    console.log('REMOVE', index);
  };

  render() {
    const { valueMappings } = this.props;

    return (
      <div>
        {valueMappings && (
          <DragDropContext onDragEnd={this.onDragEnd}>
            <Droppable droppableId="sortable-fields-transformer" direction="vertical">
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {valueMappings.map((mapping, index) => {
                    return (
                      <DraggableMapping
                        mapping={mapping}
                        index={index}
                        onChange={this.onChange}
                        onRemove={this.onRemove}
                        key={index}
                      />
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  toggle: css`
    margin: 0 8px;
    color: ${theme.colors.textWeak};
  `,
  draggable: css`
    padding: 0;
    font-size: ${theme.typography.size.md};
    opacity: 0.4;
    &:hover {
      color: ${theme.colors.textStrong};
    }
  `,
  name: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.weight.semibold};
  `,
}));
