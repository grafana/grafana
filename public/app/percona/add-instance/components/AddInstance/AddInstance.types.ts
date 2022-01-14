export interface SelectInstanceProps {
  type: string;
  title: string;
  selectInstanceType: (type: string) => () => void;
}

export interface AddInstanceProps {
  onSelectInstanceType: (arg: { type: string }) => void;
}
