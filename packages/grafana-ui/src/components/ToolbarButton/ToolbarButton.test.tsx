import { render, screen } from '@testing-library/react';

import { ToolbarButton, type ToolbarButtonVariant } from './ToolbarButton';

const variants: ToolbarButtonVariant[] = ['default', 'canvas', 'active', 'primary', 'destructive'];

function collectStyleRules(rules: CSSRuleList, result: CSSStyleRule[] = []): CSSStyleRule[] {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    } else if (rule instanceof CSSMediaRule) {
      collectStyleRules(rule.cssRules, result);
    }
  }
  return result;
}

/**
 * jsdom can't put an element in the :hover state, so instead find the CSS rules that only
 * apply because of :hover: a selector that matches the element once its :hover is removed.
 * Returns the properties those rules would change when the element is hovered.
 */
function getHoverOnlyProperties(element: Element): string[] {
  const properties: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of collectStyleRules(sheet.cssRules)) {
      const hoverSelectors = rule.selectorText.split(',').filter((selector) => selector.includes(':hover'));
      const appliesOnHover = hoverSelectors.some((selector) => element.matches(selector.replaceAll(':hover', '')));

      if (appliesOnHover) {
        properties.push(...Array.from(rule.style));
      }
    }
  }

  return properties;
}

describe('ToolbarButton', () => {
  describe.each(variants)('%s variant', (variant) => {
    it('changes its look on hover when enabled', () => {
      render(<ToolbarButton variant={variant}>Click me</ToolbarButton>);

      expect(getHoverOnlyProperties(screen.getByRole('button'))).toContain('background');
    });

    it('looks the same hovered and not hovered when disabled', () => {
      render(
        <ToolbarButton variant={variant} disabled>
          Click me
        </ToolbarButton>
      );

      expect(getHoverOnlyProperties(screen.getByRole('button'))).toEqual([]);
    });
  });
});
