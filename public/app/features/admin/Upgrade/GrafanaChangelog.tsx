interface Props {
  changelog?: string;
}

export function GrafanaChangelog({ changelog }: Props) {
  if (!changelog) {
    return <p>No changelog available.</p>;
  }
  return (
    changelog
  );
}

