export interface SelectInstanceProps {
  type: string;
  title: string;
  selectInstanceType: (string) => () => void;
}

export interface AddInstanceProps {
  onSelectInstanceType: (any) => void;
}
