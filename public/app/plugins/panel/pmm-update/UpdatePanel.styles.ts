import { css } from '@emotion/css';

export const panel = css`
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100%;

  p {
    margin-bottom: 0;
  }

  @media (max-width: 1281px) {
    #pmm-update-widget h2 {
      font-size: 1.55rem;
      margin-bottom: 0.1rem;
    }
  }
`;

export const middleSectionWrapper = css`
  align-items: center;
  display: flex;
  flex: 1;
  justify-content: center;
`;
