export type DBIconType = 'edit' | 'see' | 'delete' | 'restore' | 'backup';

export interface DBIconProps extends React.HTMLAttributes<HTMLOrSVGElement> {
  type: DBIconType;
  size?: number;
  tooltipText?: string;
}

export interface IconProps {
  size?: number;
}

export type DBIconMap = {
  [key in DBIconType]: React.FC<IconProps>;
};
