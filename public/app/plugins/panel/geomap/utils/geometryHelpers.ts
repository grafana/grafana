import { Coordinate } from 'ol/coordinate';
import { Polygon, MultiPolygon } from 'ol/geom';

function fixAntimeridianSimplePolygon(geometry: Polygon): MultiPolygon | Polygon {
  // Get the coordinates of the polygon
  const coordinates = geometry.getCoordinates();
  const exteriorRing = coordinates[0];

  // Check if the polygon crosses the antimeridian
  let crossesAntimeridian = false;
  for (let i = 0; i < exteriorRing.length - 1; i++) {
    const [lon1] = exteriorRing[i];
    const [lon2] = exteriorRing[i + 1];

    // If the difference between longitudes is greater than 180 degrees,
    // it likely crosses the antimeridian
    if (Math.abs(lon1 - lon2) > 180) {
      crossesAntimeridian = true;
      break;
    }
  }

  if (!crossesAntimeridian) {
    return geometry; // No need to fix if it doesn't cross the antimeridian
  }

  // Split the ring into western and eastern parts
  const westernRing: Coordinate[] = [];
  const easternRing: Coordinate[] = [];

  for (let i = 0; i < exteriorRing.length; i++) {
    const point = exteriorRing[i];
    const nextPoint = exteriorRing[(i + 1) % exteriorRing.length];

    westernRing.push([...point]);
    easternRing.push([...point]);

    if (i < exteriorRing.length - 1) {
      const [lon1, lat1] = point;
      const [lon2, lat2] = nextPoint;

      if (Math.abs(lon1 - lon2) > 180) {
        // Line crosses the antimeridian
        // Calculate the latitude at which the line crosses the antimeridian
        const ratio =
          Math.abs(lon1) > 170 && lon1 > 0
            ? (180 - lon1) / (360 - (lon1 - lon2))
            : (180 + lon1) / (360 + (lon1 - lon2));

        const latCross = lat1 + ratio * (lat2 - lat1);

        // Add points at the antimeridian
        westernRing.push([-180, latCross]);
        easternRing.push([180, latCross]);
      }
    }
  }

  // Close the rings
  if (
    westernRing[0][0] !== westernRing[westernRing.length - 1][0] ||
    westernRing[0][1] !== westernRing[westernRing.length - 1][1]
  ) {
    westernRing.push([...westernRing[0]]);
  }

  if (
    easternRing[0][0] !== easternRing[easternRing.length - 1][0] ||
    easternRing[0][1] !== easternRing[easternRing.length - 1][1]
  ) {
    easternRing.push([...easternRing[0]]);
  }

  // Clean up the rings - ensure western points are in range [-180, 0]
  westernRing.forEach((point) => {
    if (point[0] > 0) {
      point[0] -= 360;
    }
  });

  // Ensure eastern points are in range [0, 180]
  easternRing.forEach((point) => {
    if (point[0] < 0) {
      point[0] += 360;
    }
  });

  return new MultiPolygon([[westernRing], [easternRing]]);
}

export default fixAntimeridianSimplePolygon;
