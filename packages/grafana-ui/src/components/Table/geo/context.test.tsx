import { render, screen } from '@testing-library/react';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';

import { useOpenLayersContext } from './OpenLayersContext';
import { OpenLayersProvider } from './OpenLayersProvider';

import { LazyOpenLayersProvider } from '.';

describe('OpenLayersContext', () => {
  const DemoComponent = () => {
    const { formatGeometry } = useOpenLayersContext();
    if (!formatGeometry) {
      return <div>formatGeometry was not defined</div>;
    }
    return <div>{formatGeometry(new Point(fromLonLat([-74.0445, 40.6892])))}</div>;
  };

  const textOutput = 'POINT(-74.0445 40.68919999999997)';

  it('should provide a formatGeometry function that converts a Geometry to WKT', () => {
    render(
      <OpenLayersProvider>
        <DemoComponent />
      </OpenLayersProvider>
    );

    expect(screen.getByText(textOutput)).toBeInTheDocument();
  });

  it('should lazy load the OpenLayersProvider', async () => {
    render(
      <LazyOpenLayersProvider>
        <DemoComponent />
      </LazyOpenLayersProvider>
    );

    // Wait for the lazy component to load and render
    expect(screen.queryByText(textOutput)).not.toBeInTheDocument();
    const resolvedComponent = await screen.findByText(textOutput);
    expect(resolvedComponent).toBeInTheDocument();
  });

  it('should return undefined for formatGeometry if not wrapped in OpenLayersProvider', () => {
    render(<DemoComponent />);

    expect(screen.getByText('formatGeometry was not defined')).toBeInTheDocument();
  });
});
