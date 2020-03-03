import React, { useRef, Component, createRef, RefObject, ComponentType, KeyboardEvent } from 'react';
import { ExtendedOptionProps } from './SelectOption';

const scrollIntoView = (optionRef: RefObject<HTMLElement> | null, scrollRef: RefObject<any>) => {
  if (!optionRef || !optionRef.current || !scrollRef || !scrollRef.current || !scrollRef.current.container) {
    return;
  }

  const { container, scrollTop } = scrollRef.current;
  const option = optionRef.current;
  const containerRect = container.getBoundingClientRect();
  const optionRect = option.getBoundingClientRect();

  if (optionRect.bottom > containerRect.bottom) {
    scrollTop(option.offsetTop + option.clientHeight - container.offsetHeight);
  } else if (optionRect.top < containerRect.top) {
    scrollTop(option.offsetTop);
  }
};

export const withSelectArrowNavigation = <P extends any>(WrappedComponent: ComponentType<P>) => {
  return class Select extends Component<P> {
    focusedOptionRef: RefObject<HTMLElement> | null = null;
    scrollRef = createRef();
    render() {
      const { components } = this.props;
      return (
        <WrappedComponent
          {...this.props}
          components={{
            ...components,
            MenuList: (props: ExtendedOptionProps) => {
              return <components.MenuList {...props} scrollRef={this.scrollRef} />;
            },
            Option: (props: ExtendedOptionProps) => {
              const innerRef = useRef<HTMLElement>(null);
              if (props.isFocused) {
                this.focusedOptionRef = innerRef;
              }
              return <components.Option {...props} ref={innerRef} />;
            },
          }}
          onKeyDown={(e: KeyboardEvent) => {
            const { onKeyDown } = this.props;
            onKeyDown && onKeyDown(e);
            if (e.keyCode === 38 || e.keyCode === 40) {
              setTimeout(() => {
                scrollIntoView(this.focusedOptionRef, this.scrollRef);
              });
            }
          }}
        />
      );
    }
  };
};
