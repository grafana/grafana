import { Tag } from './Tag';

interface Props {
  name: string;
  color: string;
}

/**
 * Static tag for a resolved data color, not a hue from the stock Tag palette.
 * The marker lets Table outline fully transparent fills on the tag itself.
 */
export function CustomColorTag({ name, color }: Props) {
  return <Tag name={name} baseColor={color} data-grafana-custom-color-tag="" />;
}
