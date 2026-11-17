import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import * as React from 'react';

import { textUtil } from '@grafana/data';

import { type IconName, type IconSize, type IconType } from '../../types/icon';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { type PopoverContent, type TooltipPlacement } from '../Tooltip/types';

export type IconElementProps = {
  className?: string;
  size?: IconSize;
};

interface AbstractButtonCommonProps {
  /** Class name for the root element. AbstractButton has no styles of its own. */
  className?: string;
  /** An icon name, or an element that accepts `className` and `size`. */
  icon?: IconName | ReactElement<IconElementProps>;
  /** Size passed to the icon. */
  iconSize?: IconSize;
  /** Position of the icon relative to the children. Defaults to `left`. */
  iconPlacement?: 'left' | 'right';
  /** Class name for the icon. */
  iconClassName?: string;
  /** Class name for the element that wraps the children. */
  contentClassName?: string;
  /** Tooltip content. A string tooltip is also the accessible name when there are no children and no `aria-label`. */
  tooltip?: PopoverContent;
  tooltipPlacement?: TooltipPlacement;
  /** A disabled button ignores clicks. A disabled anchor leaves the tab order. */
  disabled?: boolean;
  'aria-label'?: string;
  children?: ReactNode;
}

type AnchorOnlyAttribute = Exclude<
  keyof AnchorHTMLAttributes<HTMLAnchorElement>,
  keyof ButtonHTMLAttributes<HTMLButtonElement>
>;

// Anchor-only attributes, href among them, are typed never: without this TypeScript accepts them when href is absent.
type ButtonElementProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof AbstractButtonCommonProps> & {
  [Attribute in AnchorOnlyAttribute]?: never;
} & {
  ref?: Ref<HTMLButtonElement>;
};

type AnchorElementProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof AbstractButtonCommonProps | 'href'> & {
  /** Passing `href`, even as `undefined`, renders an anchor. Omit the prop to render a button. */
  href: string | undefined;
  ref?: Ref<HTMLAnchorElement>;
};

export type AbstractButtonAsButtonProps = AbstractButtonCommonProps & ButtonElementProps;
export type AbstractButtonAsAnchorProps = AbstractButtonCommonProps & AnchorElementProps;
export type AbstractButtonProps = AbstractButtonAsButtonProps | AbstractButtonAsAnchorProps;

const isAnchorElementProps = (props: ButtonElementProps | AnchorElementProps): props is AnchorElementProps =>
  'href' in props;

/**
 * The unstyled structure shared by Button and LinkButton: the root element, icon, content, tooltip and
 * accessible name. It renders an anchor when the `href` prop is passed and a button otherwise.
 */
export const AbstractButton = ({
  className,
  icon,
  iconSize,
  iconPlacement = 'left',
  iconClassName,
  contentClassName,
  tooltip,
  tooltipPlacement,
  disabled,
  'aria-label': ariaLabel,
  children,
  ...elementProps
}: AbstractButtonProps) => {
  const hasTooltip = Boolean(tooltip);
  const accessibleLabel = ariaLabel ?? (!children && typeof tooltip === 'string' ? tooltip : undefined);
  const iconComponent = icon && <IconRenderer icon={icon} size={iconSize} className={iconClassName} />;
  const content = (
    <>
      {iconPlacement === 'left' && iconComponent}
      {children && <span className={contentClassName}>{children}</span>}
      {iconPlacement === 'right' && iconComponent}
    </>
  );

  if (isAnchorElementProps(elementProps)) {
    const { href, ref, ...anchorProps } = elementProps;
    // When using tooltip, ref is forwarded to Tooltip component instead for https://github.com/grafana/grafana/issues/65632
    const anchor = (
      <a
        className={className}
        {...anchorProps}
        href={href ? textUtil.sanitizeUrl(href) : href}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        ref={tooltip ? undefined : ref}
        aria-label={accessibleLabel}
      >
        {content}
      </a>
    );

    return tooltip ? (
      <Tooltip ref={ref} content={tooltip} placement={tooltipPlacement}>
        {anchor}
      </Tooltip>
    ) : (
      anchor
    );
  }

  const { type = 'button', onClick, ref, ...buttonProps } = elementProps;
  // When using tooltip, ref is forwarded to Tooltip component instead for https://github.com/grafana/grafana/issues/65632
  const button = (
    <button
      className={className}
      type={type}
      onClick={disabled ? undefined : onClick}
      {...buttonProps}
      // In order for the tooltip to be accessible when disabled,
      // we need to set aria-disabled instead of the native disabled attribute
      aria-disabled={hasTooltip && disabled}
      disabled={!hasTooltip && disabled}
      ref={tooltip ? undefined : ref}
      aria-label={accessibleLabel}
    >
      {content}
    </button>
  );

  return tooltip ? (
    <Tooltip ref={ref} content={tooltip} placement={tooltipPlacement}>
      {button}
    </Tooltip>
  ) : (
    button
  );
};

AbstractButton.displayName = 'AbstractButton';

interface IconRendererProps {
  icon?: IconName | ReactElement<IconElementProps>;
  size?: IconSize;
  className?: string;
  iconType?: IconType;
}

export const IconRenderer = ({ icon, size, className, iconType }: IconRendererProps) => {
  if (!icon) {
    return null;
  }
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon, {
      className,
      size,
    });
  }
  return <Icon name={icon} size={size} className={className} type={iconType} />;
};
