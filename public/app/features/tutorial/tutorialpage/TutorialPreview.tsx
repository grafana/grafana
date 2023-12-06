import React from 'react';

import type { Tutorial } from 'app/features/tutorial/types';

type TutorialPreviewProps = {
  tutorial: Tutorial;
};

export const TutorialPreview = ({ tutorial }: TutorialPreviewProps) => {
  return <div>Tutorial preview</div>;
};
