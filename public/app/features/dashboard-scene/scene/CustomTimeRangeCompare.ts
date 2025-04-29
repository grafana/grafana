import React from 'react';

import { SceneTimeRangeCompare, SceneComponentProps } from '@grafana/scenes';

export class CustomTimeRangeCompare extends SceneTimeRangeCompare {
  constructor(state: Partial<SceneTimeRangeCompare['state']> = {}) {
    super({
      ...state,
      // Hide the comparison checkbox by default
      compareWith: undefined,
      compareOptions: [],
    });
  }

  // Override the component to only show the select
  static Component = function CustomTimeRangeCompareRenderer({ model }: SceneComponentProps<CustomTimeRangeCompare>) {
    // Get the original renderer
    const OriginalRenderer = SceneTimeRangeCompare.Component;

    // Create a wrapper that will ensure the checkbox is checked
    const Wrapper = React.forwardRef<HTMLDivElement>((props, ref) => {
      React.useEffect(() => {
        // Find and check the checkbox
        const buttons = document.querySelectorAll('button');
        buttons.forEach((button) => {
          if (button.getAttribute('aria-label') === 'Enable time frame comparison') {
            button.style.display = 'none';
            const checkbox = button.querySelector('input[type="checkbox"]');
            if (checkbox) {
              (checkbox as HTMLInputElement).checked = true;
            }
          }
        });
      }, []);

      return React.createElement('div', { ref, ...props });
    });

    return React.createElement(Wrapper, null, React.createElement(OriginalRenderer, { model }));
  };
}
