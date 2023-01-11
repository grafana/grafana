// import { CubeTextureLoader } from 'three';
// import { useThree } from '@react-three/fiber';
// import { ScatterPlotOptions } from 'models.gen';
// import OptionsContext from 'optionsContext';
// import { useContext, useEffect } from 'react';

// export function SkyBox() {
//   const { scene } = useThree();
//   const loader = new CubeTextureLoader();
//   const options: ScatterPlotOptions = useContext(OptionsContext);

//   useEffect(() => {
//     const textures = [];

//     if (!options.hasSkybox) {
//       scene.background = null;
//       return;
//     }

//     for (let i = 1; i <= 6; i++) {
//       try {
//         const textureImage = require('../img/skyBoxes/' + options.skybox + '/' + i + '.jpeg');
//         textures.push(textureImage);
//       } catch (error) {
//         //if there is only one texture, fill the array with 6 copies of that and build skybox
//         for (let j = 0; j < 5; j++) {
//           textures.push(textures[0]);
//         }

//         break;
//       }
//     }

//     const texture = loader.load(textures);

//     // Set the scene background property to the resulting texture.
//     scene.background = texture;
//   }, [options.hasSkybox, options.skybox]);

//   return null;
// }
