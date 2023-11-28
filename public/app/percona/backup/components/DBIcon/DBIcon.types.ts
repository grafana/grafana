export type DBIconType = 'edit' | 'see' | 'delete' | 'backup' | 'cancel' | 'restore';

export interface DBIconProps extends React.HTMLAttributes<HTMLOrSVGElement> {
  type: DBIconType;
  size?: number;
  tooltipText?: string;
  disabled?: boolean;
}

export interface IconProps {
  size?: number;
}

export type DBIconMap = {
  [key in DBIconType]: React.FC<React.PropsWithChildren<IconProps>>;
};
