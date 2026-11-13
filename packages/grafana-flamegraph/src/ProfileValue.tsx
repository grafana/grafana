import { type ProfileValueData } from './types';

interface ProfileValueProps extends ProfileValueData {
  label: string;
}

export function ProfileValue({ label, unitValue, percentage }: ProfileValueProps) {
  return (
    <span>
      {label}: <b>{unitValue}</b> ({percentage}%)
    </span>
  );
}
