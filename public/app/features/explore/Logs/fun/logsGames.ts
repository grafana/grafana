/* eslint-disable @grafana/no-unreduced-motion */
import { css, keyframes } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrevious } from 'react-use';

import { LogLevel, LogRowModel, store } from '@grafana/data';
import { createLogRow } from 'app/features/logs/components/mocks/logRow';

const splash = `
 ▄▄                                         ██                                  
 ██                                         ▀▀                                  
 ██         ▄████▄    ▄███▄██   ▄███▄██   ████     ██▄████▄   ▄███▄██           
 ██        ██▀  ▀██  ██▀  ▀██  ██▀  ▀██     ██     ██▀   ██  ██▀  ▀██           
 ██        ██    ██  ██    ██  ██    ██     ██     ██    ██  ██    ██           
 ██▄▄▄▄▄▄  ▀██▄▄██▀  ▀██▄▄███  ▀██▄▄███  ▄▄▄██▄▄▄  ██    ██  ▀██▄▄███           
 ▀▀▀▀▀▀▀▀    ▀▀▀▀     ▄▀▀▀ ██   ▄▀▀▀ ██  ▀▀▀▀▀▀▀▀  ▀▀    ▀▀   ▄▀▀▀ ██           
                      ▀████▀▀   ▀████▀▀                       ▀████▀▀           
                                                                                                                              
  ▄▄▄▄▄▄                                       ▄▄                               
  ▀▀██▀▀                                       ██                               
    ██     ██▄████▄  ██▄  ▄██   ▄█████▄   ▄███▄██   ▄████▄    ██▄████  ▄▄█████▄ 
    ██     ██▀   ██   ██  ██    ▀ ▄▄▄██  ██▀  ▀██  ██▄▄▄▄██   ██▀      ██▄▄▄▄ ▀ 
    ██     ██    ██   ▀█▄▄█▀   ▄██▀▀▀██  ██    ██  ██▀▀▀▀▀▀   ██        ▀▀▀▀██▄ 
  ▄▄██▄▄   ██    ██    ████    ██▄▄▄███  ▀██▄▄███  ▀██▄▄▄▄█   ██       █▄▄▄▄▄██ 
  ▀▀▀▀▀▀   ▀▀    ▀▀     ▀▀      ▀▀▀▀ ▀▀    ▀▀▀ ▀▀    ▀▀▀▀▀    ▀▀        ▀▀▀▀▀▀  

                        A game made of log lines
                 Observability Logs squad / Grafana Labs

Keyboard arrows: move - Space: attack - N: new game
Press any key to start`;

const nextLevelSplash = `
 ▄▄                                      ▄▄▄▄                
 ██                                      ▀▀██                
 ██         ▄████▄   ██▄  ▄██   ▄████▄     ██                
 ██        ██▄▄▄▄██   ██  ██   ██▄▄▄▄██    ██                
 ██        ██▀▀▀▀▀▀   ▀█▄▄█▀   ██▀▀▀▀▀▀    ██                
 ██▄▄▄▄▄▄  ▀██▄▄▄▄█    ████    ▀██▄▄▄▄█    ██▄▄▄             
 ▀▀▀▀▀▀▀▀    ▀▀▀▀▀      ▀▀       ▀▀▀▀▀      ▀▀▀▀             

 Press Enter to start`;

const numbers = [
  `
   ▄▄▄    
  █▀██    
    ██    
    ██    
    ██    
 ▄▄▄██▄▄▄ 
 ▀▀▀▀▀▀▀▀ 
         `,
  `
  ▄▄▄▄▄   
 █▀▀▀▀██▄ 
       ██ 
     ▄█▀  
   ▄█▀    
 ▄██▄▄▄▄▄ 
 ▀▀▀▀▀▀▀▀ 
          `,
  `
  ▄▄▄▄▄   
 █▀▀▀▀██▄ 
      ▄██ 
   █████  
      ▀██ 
 █▄▄▄▄██▀ 
  ▀▀▀▀▀   
         `,
  `
      ▄▄▄  
    ▄███  
   █▀ ██  
 ▄█▀  ██  
 ████████ 
      ██  
      ▀▀  
         `,
  `
 ▄▄▄▄▄▄▄  
 ██▀▀▀▀▀  
 ██▄▄▄▄   
 █▀▀▀▀██▄ 
       ██ 
 █▄▄▄▄██▀ 
  ▀▀▀▀▀   `,
  `
   ▄▄▄▄   
  ██▀▀▀█  
 ██ ▄▄▄   
 ███▀▀██▄ 
 ██    ██ 
 ▀██▄▄██▀ 
   ▀▀▀▀   
         `,
  `
 ▄▄▄▄▄▄▄▄ 
 ▀▀▀▀▀███ 
     ▄██  
     ██   
    ██    
   ██     
  ▀▀      
          `,
  `
   ▄▄▄▄   
 ▄██▀▀██▄ 
 ██▄  ▄██ 
  ██████  
 ██▀  ▀██ 
 ▀██▄▄██▀ 
   ▀▀▀▀   
          `,
  `
   ▄▄▄▄   
 ▄██▀▀██▄ 
 ██    ██ 
 ▀██▄▄███ 
   ▀▀▀ ██ 
  █▄▄▄██  
   ▀▀▀▀   
          `,
  `
   ▄▄▄       ▄▄▄▄   
  █▀██      ██▀▀██  
    ██     ██    ██ 
    ██     ██ ██ ██ 
    ██     ██    ██ 
 ▄▄▄██▄▄▄   ██▄▄██  
 ▀▀▀▀▀▀▀▀    ▀▀▀▀   
                    `,
];

const gameOver = `
                                                         
 ▄▄▄▄▄▄▄                                                 
███▀▀▀▀▀                                                 
███        ▀▀█▄ ███▄███▄ ▄█▀█▄   ▄███▄ ██ ██ ▄█▀█▄ ████▄ 
███  ███▀ ▄█▀██ ██ ██ ██ ██▄█▀   ██ ██ ██▄██ ██▄█▀ ██ ▀▀ 
▀██████▀  ▀█▄██ ██ ██ ██ ▀█▄▄▄   ▀███▀  ▀█▀  ▀█▄▄▄ ██    
                                                         
                      Score: {score}

Press N to try again
`;

const success = `
                                                         
▄▄▄    ▄▄▄   ▄▄▄▄    ▄▄    ▄▄           ▄▄      ▄▄   ▄▄▄▄    ▄▄▄   ▄▄ 
 ██▄  ▄██   ██▀▀██   ██    ██           ██      ██  ██▀▀██   ███   ██ 
  ██▄▄██   ██    ██  ██    ██           ▀█▄ ██ ▄█▀ ██    ██  ██▀█  ██ 
   ▀██▀    ██    ██  ██    ██            ██ ██ ██  ██    ██  ██ ██ ██ 
    ██     ██    ██  ██    ██            ███▀▀███  ██    ██  ██  █▄██ 
    ██      ██▄▄██   ▀██▄▄██▀            ███  ███   ██▄▄██   ██   ███ 
    ▀▀       ▀▀▀▀      ▀▀▀▀              ▀▀▀  ▀▀▀    ▀▀▀▀    ▀▀   ▀▀▀ 
                         Congratulations!
                    You survived the incident
                             Score: {score}

Press N to try again
`;

const map = `Score: 000000                              Lives: ♥♥♥♥
================================================================================
                                                                                
                                   [=U=]        
                                                                                                                                                            
      <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>
      [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]
      <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>
      <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>
                                                                                
            

      


            ###              ###              ###              ###            
           #####            #####            #####            #####           
          #######          #######          #######          #######          
           #####            #####            #####            #####           
            ###              ###              ###              ###            
                                                                                
                                                                                
                                                                      
                                       /A\\
================================================================================`;

const player = '/A\\';
const initialPlayerX = 39;
const playerY = 23;

const userMissileSprite = '╫';
const userMissileRegex = new RegExp(userMissileSprite, 'g');
const enemyMissileSprite = '¦';
const enemyMissileRegex = new RegExp(enemyMissileSprite, 'g');

const initialMissileSpeed = 0.05;
const initialEnemyMissileSpeed = 0.01;
const initialEnemySpeed = 0.001;

let missileSpeed = initialMissileSpeed;
let enemyMissileSpeed = initialEnemyMissileSpeed;
let enemySpeed = initialEnemySpeed;
let ufoSpeed = 0.0095;

type Missile = {
  x: number;
  y: number;
  get gridY(): number;
  hit: boolean;
};
type Enemy = {
  x: number;
  get gridX(): number;
  sourceX: number;
  direction: 'l' | 'r';
  y: number;
  type: number;
  body: string;
  health: number;
};
type GameStatus = 'new-game' | 'paused' | 'playing' | 'ended' | 'won' | 'next-level';
const ufo = '[=U=]';
const enemyTypes = ['<@_@>', '<^_^>', '[-_-]', '<o_o>', ufo];
const enemyScores = [10, 20, 30, 40, 100];
const enemyTypeUfo = enemyTypes.indexOf(ufo);
const explosion1 = 'xX*Xx';
const explosion2 = '-X*X-';
const explosion3 = '--*--';
const explosion4 = '  *  ';
const enemySprites = [
  [explosion4, explosion3, explosion2, explosion1, '<@_@>'],
  [explosion4, explosion3, explosion2, explosion1, ' ^_^ ', '<^_^>'],
  [explosion4, explosion3, explosion2, explosion1, ' -_- ', '(-_-)', '[-_-]'],
  [explosion4, explosion3, explosion2, explosion1, ' o_o ', 'co_oↄ', '<o_o>', '<o_o>'],
  [explosion4, explosion3, explosion2, explosion1, ' =u= ', '(=u=)', ufo, ufo, ufo],
];

const shield = '#';

export function useLogsGames() {
  const [gameState, setGameState] = useState<LogRowModel[] | undefined>(undefined);
  const [playerX, setPlayerX] = useState(initialPlayerX);
  const [userMissiles, setUserMisiles] = useState<Missile[]>([]);
  const [enemyMissiles, setEnemyMissiles] = useState<Missile[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('new-game');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(4);
  const prevLives = usePrevious(lives);
  const effectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScore = usePrevious(score);
  const prevEnemies = usePrevious(enemies);
  const levelRef = useRef(1);

  const lastTime = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (gameStatus === 'new-game') {
      setGameState(getSplashScreen(splash));
    } else if (gameStatus === 'next-level') {
      setGameState(getLevelScreen(levelRef.current));
    } else if (gameStatus === 'ended') {
      setGameState(getGameOverScreen(score));
    } else if (gameStatus === 'won') {
      setGameState(getSuccessScreen(score));
    }
  }, [gameStatus, score]);

  const newGame = useCallback(() => {
    missileSpeed = initialMissileSpeed;
    enemyMissileSpeed = initialEnemyMissileSpeed;
    enemySpeed = initialEnemySpeed;
    levelRef.current = 1;

    setGameStatus('new-game');
    setGameState(undefined);
    setScore(0);
    setLives(4);
  }, []);

  const nextLevel = useCallback(() => {
    missileSpeed += 0.001;
    enemyMissileSpeed += 0.001;
    enemySpeed += 0.001;
    levelRef.current += 1;

    if (levelRef.current > 10) {
      setGameStatus('won');
      updateBestScore(score);
      return;
    }

    setGameStatus('next-level');
    setGameState(undefined);
    setLives(4);
  }, [score]);

  useEffect(() => {
    function loop(t: number) {
      const dt = Math.min(t - lastTime.current, 50);
      lastTime.current = t;

      const { newGameState, newUserMissiles, newEnemies, newScore, newLives, newEnemyMissiles } = update(
        dt,
        gameState,
        playerX,
        userMissiles,
        enemyMissiles,
        enemies,
        score,
        lives,
        levelRef.current
      );

      setGameState(newGameState);
      setUserMisiles(newUserMissiles);
      setEnemyMissiles(newEnemyMissiles);
      setEnemies(newEnemies);
      setScore(newScore);
      setLives(newLives);

      if (lives === 0) {
        setGameStatus('ended');
        updateBestScore(score);
        return;
      } else if (newEnemies.length === 0) {
        nextLevel();
        return;
      }

      frame.current = requestAnimationFrame(loop);
    }

    if (gameStatus === 'playing') {
      frame.current = requestAnimationFrame(loop);
    }

    return () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [enemies, enemyMissiles, gameState, gameStatus, lives, nextLevel, playerX, score, userMissiles]);

  useEffect(() => {
    function handlePause() {
      if (document.hidden) {
        setGameStatus('paused');
        console.log('Game paused');
      }
    }
    function pause() {
      setGameStatus('paused');
      console.log('Game paused');
    }
    document.addEventListener('visibilitychange', handlePause);
    document.addEventListener('blur', pause);

    return () => {
      document.removeEventListener('visibilitychange', handlePause);
      document.removeEventListener('blur', pause);
    };
  });

  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (gameStatus === 'new-game') {
        setGameStatus('next-level');
        return;
      }
      if (gameStatus === 'paused') {
        setGameStatus(gameState === undefined ? 'new-game' : 'playing');
        e.preventDefault();
        e.stopPropagation();
        return;
      } else if (gameStatus === 'next-level' && e.code === 'Enter') {
        setGameState(undefined);
        setGameStatus('playing');
        e.preventDefault();
        e.stopPropagation();
        return;
      } else if (e.code === 'KeyN') {
        newGame();
      } else if (e.code === 'KeyG') {
        nextLevel();
        return;
      }

      if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight' && e.code !== 'Space' && e.code !== 'KeyN') {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'ArrowLeft') {
        setPlayerX(Math.max(playerX - 1, 0));
      } else if (e.code === 'ArrowRight') {
        setPlayerX(Math.min(playerX + 1, 80));
      } else if (e.code === 'Space' && userMissiles.length < 2) {
        setUserMisiles([...userMissiles, newUserMissile(playerX, playerY - 1)]);
      }
    }
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [gameState, gameStatus, newGame, nextLevel, playerX, userMissiles]);

  useEffect(() => {
    if (prevLives && prevLives > lives) {
      if (effectRef.current) {
        clearTimeout(effectRef.current);
        effectRef.current = null;
      }
      const node = document.querySelectorAll('main section');
      node[node.length - 1]?.classList.add(styles.hitFlash);
      effectRef.current = setTimeout(() => {
        node[node.length - 1]?.classList.remove(styles.hitFlash);
        node[node.length - 1]?.classList.remove(styles.attack);
        node[node.length - 1]?.classList.remove(styles.destroy);
      }, 300);
    } else if (prevEnemies && prevEnemies.length < enemies.length && enemies.length < 33) {
      const node = document.querySelectorAll('main section');
      node[node.length - 1]?.classList.add(styles.destroy);
      effectRef.current = setTimeout(() => {
        node[node.length - 1]?.classList.remove(styles.hitFlash);
        node[node.length - 1]?.classList.remove(styles.attack);
        node[node.length - 1]?.classList.remove(styles.destroy);
      }, 300);
    } else if (prevScore && prevScore < score) {
      const node = document.querySelectorAll('main section');
      node[node.length - 1]?.classList.add(styles.attack);
      effectRef.current = setTimeout(() => {
        node[node.length - 1]?.classList.remove(styles.hitFlash);
        node[node.length - 1]?.classList.remove(styles.attack);
        node[node.length - 1]?.classList.remove(styles.destroy);
      }, 300);
    }
  }, [enemies.length, lives, prevEnemies, prevLives, prevScore, score]);

  return gameState;
}

function getSplashScreen(splash: string) {
  return splash.split('\n').map((row, index) => {
    return createLogRow({
      uid: index.toString(),
      entry: row.padEnd(80),
      timeEpochMs: 0,
      logLevel: LogLevel.unknown,
    });
  });
}

function getLevelScreen(level: number) {
  let screen = nextLevelSplash.split('\n');
  let number = numbers[level - 1].split('\n');

  return getSplashScreen(
    screen.map((line, index) => line + (number[index] !== undefined ? number[index] : '')).join('\n')
  );
}

function getGameOverScreen(score: number) {
  return getSplashScreen(gameOver.replace('{score}', score.toString()));
}

function getSuccessScreen(score: number) {
  return getSplashScreen(success.replace('{score}', score.toString()));
}

function update(
  dt: number,
  gameState: LogRowModel[] | undefined,
  playerX: number,
  userMissiles: Missile[],
  enemyMissiles: Missile[],
  enemies: Enemy[],
  score: number,
  lives: number,
  level: number
) {
  if (gameState === undefined) {
    const newEnemies: Enemy[] = [];
    const logs = map.split('\n').map((row, index) => {
      if (index === playerY) {
        row = row.padStart(initialPlayerX, ' ');
      }
      const foundEnemies = createEnemies(row, index);
      if (foundEnemies) {
        newEnemies.push(...foundEnemies);
      }
      return createLogRow({
        uid: index.toString(),
        entry: row.padEnd(80),
        timeEpochMs: 0,
        logLevel: LogLevel.unknown,
      });
    });
    return {
      newGameState: logs,
      newUserMissiles: userMissiles,
      newEnemyMissiles: enemyMissiles,
      newEnemies: newEnemies,
      newScore: score,
      newLives: lives,
    };
  }

  let newUserMissiles = userMissiles
    .map((missile) => {
      missile.y = missile.y - missileSpeed * dt;
      return missile;
    })
    .filter((missile) => missile.y >= 2);

  let newEnemyMissiles = enemyMissiles
    .map((missile) => {
      missile.y = missile.y + enemyMissileSpeed * dt;
      return missile;
    })
    .filter((missile) => {
      const playerStart = Math.max(0, playerX - 3);
      const playerEnd = Math.max(2, playerX - 1);
      if (missile.gridY === playerY && missile.x >= playerStart && missile.x <= playerEnd) {
        missile.hit = true;
        lives--;
        return false;
      }
      return missile.gridY <= playerY;
    });

  const lowestEnemyY = enemies.reduce((max, enemy) => Math.max(max, enemy.y), 0);
  const shieldStart = gameState.findIndex((row) => row.entry.includes('#'));
  const formationCanMoveDown = shieldStart === -1 || lowestEnemyY + 1 < shieldStart;

  const formationEnemies = enemies.filter((e) => e.type !== enemyTypeUfo && e.health > 3);
  const rightmostEnemy = formationEnemies.reduce((max, enemy) => Math.max(max, enemy.gridX), 0);
  const leftmostEnemy = formationEnemies.reduce(
    (min, enemy) => Math.min(min, enemy.gridX),
    formationEnemies.length > 0 ? formationEnemies[0].gridX : 0
  );

  const newEnemies = enemies
    .map((enemy) => {
      const speed = enemy.type === enemyTypeUfo ? ufoSpeed : enemySpeed;

      const canAttack =
        enemy.type === enemyTypeUfo ||
        !enemies.some(
          (otherEnemy) =>
            otherEnemy !== enemy &&
            otherEnemy.y > enemy.y &&
            otherEnemy.health > 3 &&
            Math.abs(otherEnemy.gridX - enemy.gridX) < 5
        );

      if (canAttack && Math.random() > 0.92 && enemyMissiles.length <= 1) {
        newEnemyMissiles.push(newEnemyMissile(enemy.gridX, enemy.y));
      }

      if (enemy.health <= 3) {
        enemy.health -= 1;
      } else if (enemy.direction === 'r') {
        enemy.x = enemy.x + speed * dt;
        if (enemy.type === enemyTypeUfo) {
          if (enemy.gridX >= 74) {
            enemy.direction = 'l';
          }
        } else if (rightmostEnemy + 4 >= 79) {
          enemy.direction = 'l';
          if (formationCanMoveDown) {
            enemy.y += 1;
          }
        }
      } else {
        enemy.x = enemy.x - speed * dt;
        if (enemy.type === enemyTypeUfo) {
          if (enemy.gridX <= 0) {
            enemy.direction = 'r';
          }
        } else if (leftmostEnemy <= 0) {
          enemy.direction = 'r';
          if (formationCanMoveDown) {
            enemy.y += 1;
          }
        }
      }
      return enemy;
    })
    .map((enemy) => {
      const missile = userMissiles.find(
        (missile) => missile.gridY === enemy.y && missile.x >= enemy.gridX && missile.x <= enemy.gridX + 4
      );
      if (missile && enemy.health > 0) {
        missile.hit = true;
        enemy.health -= 1;
        score += enemyScores[enemy.type] * level;
      }
      return enemy;
    })
    .filter((enemy) => enemy.health >= 0);

  newUserMissiles = newUserMissiles.filter((missile) => missile.hit === false);

  let hasChanges = false;

  const newGameState = gameState.map((row, index) => {
    let entry = row.entry;
    if (index === 0) {
      entry = renderScoreAndLives(score, lives, level);
    } else if (index <= 2 || index > playerY) {
      return row;
    } else if (index === playerY) {
      entry = player.padStart(playerX, ' ');
    } else if (row.entry.includes(shield)) {
      entry = handleEnvironmentCollisions(row.entry, newUserMissiles, newEnemyMissiles, index);
      newUserMissiles = newUserMissiles.filter((missile) => missile.hit === false);
      newEnemyMissiles = newEnemyMissiles.filter((missile) => missile.hit === false);
    } else {
      entry = render(row.entry, newEnemies, newUserMissiles, newEnemyMissiles, index);
    }

    if (entry !== row.entry) {
      hasChanges = true;
    } else {
      return row;
    }

    return createLogRow({
      uid: index.toString(),
      entry: entry,
      timeEpochMs: 0,
      logLevel: LogLevel.unknown,
    });
  });

  if (!hasChanges) {
    return { newGameState: gameState, newUserMissiles, newEnemies, newScore: score, newLives: lives, newEnemyMissiles };
  }

  return { newGameState, newUserMissiles, newEnemies, newScore: score, newLives: lives, newEnemyMissiles };
}

function newUserMissile(x: number, y: number): Missile {
  return {
    x: x - 2,
    y,
    get gridY() {
      return Math.ceil(this.y);
    },
    hit: false,
  };
}

function newEnemyMissile(x: number, y: number): Missile {
  return {
    x: x + 2,
    y,
    get gridY() {
      return Math.ceil(this.y);
    },
    hit: false,
  };
}

function createEnemies(row: string, y: number) {
  const enemies: Enemy[] = [];
  for (let i = 0; i < enemyTypes.length; ) {
    const index = row.indexOf(enemyTypes[i]);
    if (index >= 0) {
      const enemy: Enemy = {
        x: index,
        get gridX() {
          return Math.floor(this.x);
        },
        sourceX: index,
        direction: 'r',
        y,
        type: i,
        body: enemyTypes[i],
        health: i + 4,
      };
      enemies.push(enemy);
      row = row.replace(enemyTypes[i], '     ');
    } else {
      i++;
    }
  }
  return enemies.length ? enemies : undefined;
}

function handleEnvironmentCollisions(row: string, userMissiles: Missile[], enemyMissiles: Missile[], y: number) {
  row = row.replace(userMissileRegex, ' ');
  row = row.replace(enemyMissileRegex, ' ');
  const missiles = userMissiles.filter((missile) => missile.gridY === y);
  missiles.forEach((missile) => {
    if (row.charAt(missile.x) === shield) {
      row = row.substring(0, missile.x) + ' ' + row.substring(missile.x + 1);
      missile.hit = true;
    } else {
      row = row.substring(0, missile.x) + userMissileSprite + row.substring(missile.x + 1);
    }
  });
  enemyMissiles = enemyMissiles.filter((missile) => missile.gridY === y);
  enemyMissiles.forEach((missile) => {
    if (row.charAt(missile.x) === shield) {
      row = row.substring(0, missile.x) + ' ' + row.substring(missile.x + 1);
      missile.hit = true;
    } else {
      row = row.substring(0, missile.x) + enemyMissileSprite + row.substring(missile.x + 1);
    }
  });
  return row;
}

function render(row: string, enemies: Enemy[], userMissiles: Missile[], enemyMissiles: Missile[], y: number) {
  row = row.replace(userMissileRegex, ' ');
  row = row.replace(enemyMissileRegex, ' ');
  enemies = enemies.filter((enemy) => enemy.y === y);
  userMissiles = userMissiles.filter((missile) => missile.gridY === y);
  enemyMissiles = enemyMissiles.filter((missile) => missile.gridY === y);

  if (!enemies.length && !userMissiles.length && !enemyMissiles.length) {
    return '';
  }

  let newRow = '';

  for (let i = 0; i < 80; ) {
    const enemy = enemies.find((enemy) => enemy.gridX === i);
    const missileFromUser = userMissiles.find((missile) => missile.x === i);
    const missileFromEnemy = enemyMissiles.find((missile) => missile.x === i);
    if (enemy) {
      newRow += enemySprites[enemy.type][enemy.health];
      i += 5;
    } else if (missileFromUser) {
      newRow += userMissileSprite;
      i++;
    } else if (missileFromEnemy) {
      newRow += enemyMissileSprite;
      i++;
    } else {
      newRow += ' ';
      i++;
    }
  }

  return newRow;
}

function renderScoreAndLives(score: number, lives: number, level: number) {
  const best = getBestScore();
  if (Number.isNaN(best)) {
    return `Score: ${score.toString().padStart(6, '0')}                       Level: ${level}                             Lives: ${new Array(lives).fill('♥').join('')}`;
  }

  return `Score: ${score.toString().padStart(6, '0')}          Best: ${best.toString().padStart(6, '0')}           Level: ${level}               Lives: ${new Array(lives).fill('♥').join('')}`;
}

function updateBestScore(score: number) {
  if (!store.exists('logging_invaders_best')) {
    store.set('logging_invaders_best', score.toString());
    return;
  }
  const currentBest = getBestScore();
  if (Number.isNaN(currentBest) || score > currentBest) {
    store.set('logging_invaders_best', score.toString());
    return;
  }
}
function getBestScore() {
  return parseInt(store.get('logging_invaders_best'), 10);
}

const hitFlash = keyframes({
  '0%': {
    filter: 'brightness(2) saturate(2) hue-rotate(-20deg)',
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
  },
  '50%': {
    filter: 'brightness(0.4) saturate(0.5) hue-rotate(20deg)',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  '100%': {
    filter: 'none',
    backgroundColor: 'transparent',
  },
});

const hitShake = keyframes({
  '0%': { transform: 'translate3d(0, 0, 0) rotateZ(0deg)' },
  '20%': { transform: 'translate3d(-2px, 0, 4px) rotateZ(-2deg)' },
  '40%': { transform: 'translate3d(3px, 0, -6px) rotateZ(2deg)' },
  '60%': { transform: 'translate3d(-3px, 0, 3px) rotateZ(-1deg)' },
  '80%': { transform: 'translate3d(2px, 0, -4px) rotateZ(1deg)' },
  '100%': { transform: 'translate3d(0, 0, 0) rotateZ(0deg)' },
});
const hitShakeSoft = keyframes({
  '0%': { transform: 'translate3d(0, 0, 0) rotateZ(0deg)' },
  '20%': { transform: 'translate3d(-1px, 0, 2px) rotateZ(-1deg)' },
  '40%': { transform: 'translate3d(1.5px, 0, -3px) rotateZ(1deg)' },
  '60%': { transform: 'translate3d(-1px, 0, 1px) rotateZ(-0.5deg)' },
  '80%': { transform: 'translate3d(1px, 0, -2px) rotateZ(0.5deg)' },
  '100%': { transform: 'translate3d(0, 0, 0) rotateZ(0deg)' },
});

const styles = {
  hitFlash: css({
    animation: `${hitFlash} 180ms ease-out, ${hitShake} 150ms cubic-bezier(.36,.07,.19,.97)`,
  }),
  attack: css({
    animation: `${hitShakeSoft} 150ms cubic-bezier(.36,.07,.19,.97)`,
  }),
  destroy: css({
    animation: `${hitShake} 150ms cubic-bezier(.36,.07,.19,.97)`,
  }),
};
