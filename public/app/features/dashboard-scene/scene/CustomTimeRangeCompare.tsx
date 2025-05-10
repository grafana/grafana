import React from 'react';

import { SceneTimeRangeCompare, SceneComponentProps } from '@grafana/scenes';

export class CustomTimeRangeCompare extends SceneTimeRangeCompare {
  constructor(state: Partial<SceneTimeRangeCompare['state']> = {}) {
    super({
      ...state,
      compareWith: undefined,
      compareOptions: [],
    });
  }

  static Component = function CustomTimeRangeCompareRenderer({ model }: SceneComponentProps<CustomTimeRangeCompare>) {
    const OriginalRenderer = SceneTimeRangeCompare.Component;

    const Wrapper = React.forwardRef<HTMLDivElement, React.PropsWithChildren<{}>>((props, ref) => {
      React.useEffect(() => {
        const buttons = document.querySelectorAll('button');
        buttons.forEach((button) => {
          if (button.getAttribute('aria-label') === 'Enable time frame comparison') {
            const divs = button.querySelectorAll('div');
            divs.forEach((div) => {
              if (div.textContent?.trim() === 'Comparison') {
                div.style.display = 'none';
              }
            });
          }
        });
      }, []);

      return <div ref={ref} {...props} />;
    });

    return (
      <Wrapper>
        <OriginalRenderer model={model} />
      </Wrapper>
    );
  };
}
