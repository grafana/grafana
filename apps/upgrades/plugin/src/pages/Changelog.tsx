import React from 'react'

interface Props {
  changelog?: string;
}

export function Changelog({ changelog }: Props) {
  if (!changelog) {
    return <p>No changelog available.</p>;
  }
  return (
    changelog
  );
}